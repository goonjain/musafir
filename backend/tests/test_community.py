import os
os.environ["TESTING"] = "1"
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
app.state.testing = True
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

def test_destination_search_and_custom_creation():
    """Verify destination search and custom 'Add a new place' creation."""
    # 1. Search existing
    res = client.get("/api/destinations?q=amber")
    assert res.status_code == 200
    destinations = res.json()
    assert len(destinations) >= 1
    assert destinations[0]["id"] == "amber"

    # 2. Add custom place
    new_place_payload = {
        "name": "Nahargarh Sunset Ridge",
        "hindi": "नाहरगढ़ सनसेट रिज",
        "category": "nature",
        "tags": ["nature", "photography"],
        "sensitivity": "fragile"
    }
    create_res = client.post("/api/destinations", json=new_place_payload, headers={"X-User-Id": "explorer_1"})
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["name"] == "Nahargarh Sunset Ridge"
    assert "sunset_ridge" in created["id"]

    # 3. Search finding newly created place
    search_res = client.get("/api/destinations?q=sunset")
    assert search_res.status_code == 200
    assert any(d["id"] == created["id"] for d in search_res.json())

def test_travel_social_post_creation_and_feed():
    """Verify Travel Stories / Social feed creation and retrieval."""
    headers = {"X-User-Id": "traveller_social_1"}
    post_payload = {
        "destination_id": "amber",
        "title": "Magical Sunrise at Amber Gate",
        "content": "Arrived at 7:30 AM before tourist buses. Suraj Pol courtyard was completely quiet and serene.",
        "image_url": "data:image/jpeg;base64,mockphotodata",
        "user_name": "Aarav"
    }
    res = client.post("/api/posts", json=post_payload, headers=headers)
    assert res.status_code == 201
    post = res.json()
    assert post["title"] == "Magical Sunrise at Amber Gate"
    assert post["user_name"] == "Aarav"
    assert post["destination_name"] == "Amber Fort"
    assert post["moderation_status"] == "approved"
    assert post["likes_count"] == 0

    # Retrieve feed
    feed_res = client.get("/api/posts?destination_id=amber", headers=headers)
    assert feed_res.status_code == 200
    posts = feed_res.json()
    assert len(posts) >= 1
    assert posts[0]["id"] == post["id"]

def test_travel_post_like_and_unlike_toggle():
    """Verify like/unlike toggle and unique like constraint behavior."""
    post_res = client.post("/api/posts", json={
        "content": "Beautiful marble carvings at Royal Gaitor.",
        "user_name": "Diya"
    }, headers={"X-User-Id": "author_user"})
    post_id = post_res.json()["id"]

    # User 1 likes post
    like_res1 = client.post(f"/api/posts/{post_id}/like", headers={"X-User-Id": "user_liker_1"})
    assert like_res1.status_code == 200
    assert like_res1.json()["liked"] is True
    assert like_res1.json()["likes_count"] == 1

    # User 1 toggles like (unlikes)
    unlike_res = client.post(f"/api/posts/{post_id}/like", headers={"X-User-Id": "user_liker_1"})
    assert unlike_res.status_code == 200
    assert unlike_res.json()["liked"] is False
    assert unlike_res.json()["likes_count"] == 0

    # User 1 likes again + User 2 likes
    client.post(f"/api/posts/{post_id}/like", headers={"X-User-Id": "user_liker_1"})
    like_res2 = client.post(f"/api/posts/{post_id}/like", headers={"X-User-Id": "user_liker_2"})
    assert like_res2.status_code == 200
    assert like_res2.json()["likes_count"] == 2

def test_travel_post_comments_flow():
    """Verify commenting on travel posts."""
    post_res = client.post("/api/posts", json={
        "content": "Stepwell steps are symmetrical and stunning in morning light.",
        "user_name": "Meera"
    }, headers={"X-User-Id": "post_creator"})
    post_id = post_res.json()["id"]

    # Add comment
    comment_res = client.post(f"/api/posts/{post_id}/comments", json={
        "content": "What is the best time to avoid tour buses?",
        "user_name": "Rohan"
    }, headers={"X-User-Id": "commenter_1"})
    assert comment_res.status_code == 201
    assert comment_res.json()["content"] == "What is the best time to avoid tour buses?"
    assert comment_res.json()["user_name"] == "Rohan"

    # Get comments
    get_res = client.get(f"/api/posts/{post_id}/comments")
    assert get_res.status_code == 200
    comments = get_res.json()
    assert len(comments) == 1
    assert comments[0]["content"] == "What is the best time to avoid tour buses?"

def test_social_content_moderation_abusive_language():
    """Verify that profanity or spam links are flagged for moderation."""
    # Obfuscated profanity in post
    res = client.post("/api/posts", json={
        "content": "Check this out b a s t a r d scam discount",
        "user_name": "Troll"
    }, headers={"X-User-Id": "spammer"})
    assert res.status_code == 201
    assert res.json()["moderation_status"] == "flagged"

    # Spam link in comment
    post = client.post("/api/posts", json={
        "content": "Clean travel story here.",
    }, headers={"X-User-Id": "clean_user"}).json()

    comment_res = client.post(f"/api/posts/{post['id']}/comments", json={
        "content": "Click http://free-crypto-giveaway.xyz for prizes",
    }, headers={"X-User-Id": "spammer"})
    assert comment_res.status_code == 201
    assert comment_res.json()["moderation_status"] == "flagged"

