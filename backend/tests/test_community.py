import os
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models import Destination, User, CrowdReport, Reward, AccuracyVote
from backend.app.config import settings

# Test in-memory SQLite database with StaticPool
TEST_DB_URL = "sqlite:///:memory:"
engine_test = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="function", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine_test)
    db = TestingSessionLocal()
    # Seed Amber Fort and Jaigarh
    db.add(Destination(id="amber", name="Amber Fort", base_crowd=62, is_gem=False, alternatives=["jaigarh"]))
    db.add(Destination(id="jaigarh", name="Jaigarh Fort", base_crowd=30, is_gem=True, alternatives=[]))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine_test)

client = TestClient(app)

def test_empty_feed_shows_no_fabricated_data():
    """Requirement 11: Production community feed has NO fabricated data."""
    res = client.get("/api/crowd-reports")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 0
    assert data["reports"] == []

def test_submit_valid_crowd_report_persists_and_awards_points():
    """Requirement 6 & 10: Persist report, generate timestamp, award persistent points."""
    headers = {"X-User-Id": "user_traveler_1"}
    payload = {
        "destination_id": "amber",
        "crowd_level": "Busy",
        "vs_forecast": "About right",
        "wait_minutes": 25,
        "tip": "Elephant ride queue is long, walked up the ramp instead.",
        "user_name": "Arjun K."
    }
    res = client.post("/api/crowd-reports", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert data["points_awarded"] == 20
    assert data["total_points"] == 20
    assert data["report"]["destination_id"] == "amber"
    assert data["report"]["crowd_level"] == "Busy"
    assert data["report"]["wait_minutes"] == 25
    assert data["report"]["tip"] == payload["tip"]
    assert "submitted_at" in data["report"]
    assert data["report"]["moderation_status"] == "approved"

    # Verify retrieval from feed across sessions
    feed_res = client.get("/api/crowd-reports?destination_id=amber")
    assert feed_res.status_code == 200
    feed_data = feed_res.json()
    assert feed_data["count"] == 1
    assert feed_data["reports"][0]["tip"] == payload["tip"]
    assert feed_data["reports"][0]["user_name"] == "Arjun K."

def test_validation_rejects_invalid_destination_and_crowd_level():
    """Requirement 6: Server-side validation rejects invalid values."""
    headers = {"X-User-Id": "user_traveler_1"}
    # Invalid destination
    res1 = client.post("/api/crowd-reports", json={"destination_id": "non_existent_fort", "crowd_level": "Quiet"}, headers=headers)
    assert res1.status_code == 404

    # Invalid crowd level
    res2 = client.post("/api/crowd-reports", json={"destination_id": "amber", "crowd_level": "SuperPacked"}, headers=headers)
    assert res2.status_code == 422

def test_rate_limit_blocks_duplicate_report_within_45_minutes():
    """Requirement 8 & 9: One report per user per place every 45 minutes."""
    headers = {"X-User-Id": "user_spammer"}
    payload = {"destination_id": "amber", "crowd_level": "Quiet", "tip": "Nice visit"}
    
    # First report succeeds
    res1 = client.post("/api/crowd-reports", json=payload, headers=headers)
    assert res1.status_code == 201

    # Second report within 45 min is rejected
    res2 = client.post("/api/crowd-reports", json=payload, headers=headers)
    assert res2.status_code == 429
    assert "Rate limit" in res2.json()["detail"]

def test_daily_points_cap_enforced():
    """Requirement 10: Persistent points daily cap (100 pts max)."""
    headers = {"X-User-Id": "point_farmer"}
    db = TestingSessionLocal()
    # Create 6 distinct destinations to bypass per-place rate limits
    for i in range(1, 7):
        db.add(Destination(id=f"dest_{i}", name=f"Place {i}", base_crowd=30))
    db.commit()
    db.close()

    total_points = 0
    # Submit 5 reports on 5 different destinations (20 pts each = 100 pts)
    for i in range(1, 6):
        res = client.post("/api/crowd-reports", json={"destination_id": f"dest_{i}", "crowd_level": "Quiet"}, headers=headers)
        assert res.status_code == 201
        total_points = res.json()["total_points"]

    assert total_points == 100

    # 6th report succeeds but awards 0 points due to daily cap
    res6 = client.post("/api/crowd-reports", json={"destination_id": "dest_6", "crowd_level": "Quiet"}, headers=headers)
    assert res6.status_code == 201
    assert res6.json()["points_awarded"] == 0
    assert "Daily points cap reached" in res6.json()["message"]

def test_accuracy_voting_and_duplicate_vote_prevention():
    """Feature doc Section 3.4: Accuracy votes adjust trust weight; duplicate vote rejected."""
    # User A submits a report
    res_sub = client.post("/api/crowd-reports", json={"destination_id": "amber", "crowd_level": "Busy"}, headers={"X-User-Id": "user_a"})
    report_id = res_sub.json()["report"]["id"]

    # User A cannot vote on their own report
    self_vote = client.post("/api/accuracy-votes", json={"report_id": report_id, "vote": 1}, headers={"X-User-Id": "user_a"})
    assert self_vote.status_code == 400

    # User B votes "Still accurate?" (+1)
    res_vote = client.post("/api/accuracy-votes", json={"report_id": report_id, "vote": 1}, headers={"X-User-Id": "user_b"})
    assert res_vote.status_code == 200
    assert res_vote.json()["success"] is True
    assert res_vote.json()["trust_weight"] > 1.0

    # User B cannot vote again
    dup_vote = client.post("/api/accuracy-votes", json={"report_id": report_id, "vote": 1}, headers={"X-User-Id": "user_b"})
    assert dup_vote.status_code == 400

def test_live_crowd_adjustment_and_stale_window():
    """Feature doc Section 4: Live crowd adjustment with time decay and 2-hour stale window."""
    # 1. No reports -> Baseline "Estimated"
    res1 = client.get("/api/places/amber/live-crowd")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["adjustment"] == 0
    assert data1["report_count"] == 0
    assert data1["status_label"] == "Estimated"

    # 2. Add recent "Busy" report -> Adjusts live score upwards
    client.post("/api/crowd-reports", json={"destination_id": "amber", "crowd_level": "Packed"}, headers={"X-User-Id": "user_observer"})
    res2 = client.get("/api/places/amber/live-crowd")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["report_count"] == 1
    assert data2["adjustment"] > 0
    assert "Estimated, adjusted by 1 report in the last" in data2["status_label"]

    # 3. Reports older than 2 hours (120 min) become stale and stop affecting live crowd
    db = TestingSessionLocal()
    old_report = db.query(CrowdReport).first()
    old_report.submitted_at = datetime.now(timezone.utc) - timedelta(minutes=130)
    db.commit()
    db.close()

    res3 = client.get("/api/places/amber/live-crowd")
    data3 = res3.json()
    assert data3["report_count"] == 0
    assert data3["adjustment"] == 0
    assert data3["status_label"] == "Estimated"

def test_flagging_and_admin_moderation_security():
    """Feature doc Section 8: Unauthorized users cannot call admin endpoints; admin can moderate."""
    # 1. Flag a report
    res_sub = client.post("/api/crowd-reports", json={"destination_id": "amber", "crowd_level": "Quiet", "tip": "Some text"}, headers={"X-User-Id": "user_x"})
    report_id = res_sub.json()["report"]["id"]

    flag_res = client.post(f"/api/reports/{report_id}/flag", headers={"X-User-Id": "user_y"})
    assert flag_res.status_code == 200

    # 2. Unauthorized admin access is rejected (403)
    unauth = client.get("/api/admin/reports")
    assert unauth.status_code == 403

    # 3. Authorized admin access succeeds
    admin_headers = {"X-Admin-Token": settings.ADMIN_SECRET_KEY}
    admin_get = client.get("/api/admin/reports?status_filter=flagged", headers=admin_headers)
    assert admin_get.status_code == 200
    assert len(admin_get.json()["reports"]) == 1

    # 4. Admin rejects report -> revokes points and excludes from feed
    mod_action = client.patch(f"/api/admin/reports/{report_id}", json={"status": "rejected"}, headers=admin_headers)
    assert mod_action.status_code == 200
    assert mod_action.json()["new_status"] == "rejected"

    # User X's points should now be 0 because rejected reports cannot earn rewards
    balance = client.get("/api/rewards/balance", headers={"X-User-Id": "user_x"})
    assert balance.json()["total_points"] == 0

def test_hidden_gem_suggestions_and_alternatives():
    """Feature doc Section 5: Private suggestion queue and on-demand alternatives."""
    # User submits hidden gem suggestion privately
    res = client.post("/api/gem-suggestions", json={
        "place_name": "Galta Ji (Monkey Temple)",
        "description": "Historic temple complex in a narrow crevice with natural springs.",
        "similar_to_destination_id": "amber",
        "vibe_tags": ["heritage", "nature"],
        "fragile_flag": True
    }, headers={"X-User-Id": "user_scout"})
    assert res.status_code == 201

    # Visible only to submitter
    my_suggs = client.get("/api/gem-suggestions/mine", headers={"X-User-Id": "user_scout"})
    assert len(my_suggs.json()["suggestions"]) == 1

    other_user = client.get("/api/gem-suggestions/mine", headers={"X-User-Id": "user_stranger"})
    assert len(other_user.json()["suggestions"]) == 0

    # On-demand alternatives for Amber Fort
    alts = client.get("/api/places/amber/alternatives")
    assert alts.status_code == 200
    assert len(alts.json()["alternatives"]) >= 1
    assert alts.json()["alternatives"][0]["id"] == "jaigarh"
    assert "room_left_score" in alts.json()["alternatives"][0]
