import datetime
from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from backend.app.database import get_db
from backend.app.models import Destination, CrowdReport, Reward, AccuracyVote
from backend.app.routers.community import get_or_create_user, format_relative_time
from backend.app.services.crowd_engine import calculate_baseline_forecast, compute_live_crowd_adjustment, get_crowd_level_category
from backend.app.services.moderation import check_moderation
from backend.app.config import settings

router = APIRouter(prefix="/api", tags=["Legacy Compatibility"])

@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Musafir Python FastAPI Backend (PostgreSQL backed)",
        "version": "2.0.0",
        "community_feature": "functional_database_backed"
    }

@router.get("/places")
def get_places(db: Session = Depends(get_db)):
    dests = db.query(Destination).all()
    places_list = []
    for d in dests:
        places_list.append({
            "id": d.id,
            "name": d.name,
            "hindi": d.hindi,
            "tags": d.tags,
            "base": d.base_crowd,
            "entry": d.cost,
            "gem": d.is_gem,
            "alternatives": d.alternatives,
            "capacity": d.capacity,
            "sensitivity": d.sensitivity,
        })
    return {"count": len(places_list), "places": places_list}

@router.get("/pulse")
def get_pulse(db: Session = Depends(get_db)):
    now = datetime.datetime.now(datetime.timezone.utc)
    reports = db.query(CrowdReport).join(Destination).join(Destination.reports).filter(
        CrowdReport.moderation_status != "rejected"
    ).order_by(CrowdReport.submitted_at.desc()).limit(20).all()

    formatted_reports = []
    for r in reports:
        formatted_reports.append({
            "id": r.id,
            "place": r.destination_id,
            "user": r.user.username,
            "status": r.crowd_level,
            "tip": r.tip,
            "ago": format_relative_time(r.submitted_at, now),
        })

    # Compute live pulse adjustments per place based on recent reports
    stale_cutoff = now - datetime.timedelta(minutes=settings.STALE_WINDOW_MINUTES)
    recent = db.query(CrowdReport).filter(CrowdReport.submitted_at >= stale_cutoff).all()
    by_place = {}
    for r in recent:
        by_place.setdefault(r.destination_id, []).append(r)

    pulse_adjustments = {}
    for place_id, p_reports in by_place.items():
        adj, count, _, _, _ = compute_live_crowd_adjustment(p_reports, now=now)
        if adj != 0:
            pulse_adjustments[place_id] = adj

    return {
        "reports": formatted_reports,
        "pulseAdjustments": pulse_adjustments,
    }

@router.post("/pulse")
def submit_pulse(
    request_data: dict,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    now = datetime.datetime.now(datetime.timezone.utc)
    place_id = request_data.get("place", "hawa")
    status_str = request_data.get("status", "Quiet")
    tip = (request_data.get("tip") or "").strip()
    user_name = request_data.get("user", "Traveller")

    user = get_or_create_user(db, x_user_id, user_name)
    dest = db.query(Destination).filter(Destination.id == place_id).first()
    if not dest:
        dest = Destination(id=place_id, name=place_id.capitalize(), base_crowd=50)
        db.add(dest)
        db.commit()
        db.refresh(dest)

    mod_status, _ = check_moderation(tip)
    baseline_score, _ = calculate_baseline_forecast(base=dest.base_crowd, is_gem=dest.is_gem, hour=now.hour)

    report = CrowdReport(
        user_id=user.id,
        destination_id=dest.id,
        crowd_level=status_str,
        tip=tip,
        observed_at=now,
        submitted_at=now,
        forecast_score_at_report=baseline_score,
        moderation_status=mod_status,
        trust_weight=1.0,
    )
    db.add(report)
    db.flush()

    points_awarded = 0
    if mod_status == "approved":
        one_day_ago = now - datetime.timedelta(hours=24)
        daily_points = db.query(func.coalesce(func.sum(Reward.points), 0)).filter(
            Reward.user_id == user.id, Reward.created_at >= one_day_ago
        ).scalar() or 0

        if daily_points < settings.DAILY_POINTS_CAP:
            ref_id = f"pulse_report_{report.id}"
            reward = Reward(
                user_id=user.id,
                points=settings.POINTS_PER_CHECKIN,
                reason=f"Check-in at {dest.name}",
                reference_id=ref_id,
                created_at=now
            )
            db.add(reward)
            points_awarded = settings.POINTS_PER_CHECKIN

    db.commit()
    db.refresh(report)

    # Return pulse state
    return get_pulse(db=db)

# Musafir Circle simulation state
circle_votes = {"jaigarh": 2, "panna": 1, "albert": 1}

@router.get("/circle")
def get_circle():
    return {
        "options": [
            {"id": "jaigarh", "name": "Jaigarh Fort", "votes": circle_votes.get("jaigarh", 0)},
            {"id": "panna", "name": "Panna Meena Kund", "votes": circle_votes.get("panna", 0)},
            {"id": "albert", "name": "Albert Hall Museum", "votes": circle_votes.get("albert", 0)},
        ]
    }

@router.post("/circle/vote")
def vote_circle(payload: dict):
    place_id = payload.get("placeId")
    if place_id in circle_votes:
        circle_votes[place_id] += 1
    return {"success": True, "votes": circle_votes}

@router.post("/simulator")
def run_simulator(payload: dict):
    shift = payload.get("shift", 20)
    amber_score = max(20, min(95, round(86 - shift * 1.1)))
    jaigarh_score = max(20, min(95, round(42 + shift * 0.5)))
    panna_score = max(20, min(95, round(28 + shift * 0.4)))
    wait = max(10, round(110 - shift * 2.4))
    rev = round(shift * 0.9 * 10) / 10

    return {
        "shift": shift,
        "amber": {"score": amber_score},
        "jaigarh": {"score": jaigarh_score},
        "panna": {"score": panna_score},
        "metrics": {
            "avgWaitTimeAmberMinutes": wait,
            "localBusinessUpliftLakhs": rev,
        }
    }
