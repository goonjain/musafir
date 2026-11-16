import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from backend.app.database import get_db
from backend.app.models import User, Destination, CrowdReport, AccuracyVote, Reward
from backend.app.schemas import (
    CrowdReportCreate, CrowdReportResponse, LiveCrowdResponse,
    AccuracyVoteCreate, ReportFlagCreate, DestinationCreate, DestinationResponse
)
from backend.app.services.moderation import check_moderation
from backend.app.services.crowd_engine import (
    calculate_baseline_forecast, compute_live_crowd_adjustment, get_crowd_level_category
)
from backend.app.config import settings

router = APIRouter(prefix="/api", tags=["Community"])

def get_or_create_user(db: Session, user_id: Optional[str], username: Optional[str] = None) -> User:
    """Ensures a persistent user record exists for the given user ID."""
    if not user_id:
        import uuid
        user_id = f"traveller_{uuid.uuid4().hex[:8]}"
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        display_name = username.strip() if username and username.strip() else f"Traveller {user_id[-4:]}"
        user = User(id=user_id, username=display_name, role="traveller")
        db.add(user)
        db.commit()
        db.refresh(user)
    elif username and username.strip() and user.username != username.strip():
        user.username = username.strip()
        db.commit()
    return user

def format_relative_time(dt: datetime.datetime, now: Optional[datetime.datetime] = None) -> str:
    if now is None:
        now = datetime.datetime.now(datetime.timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    diff = (now - dt).total_seconds()
    if diff < 60:
        return "just now"
    minutes = int(diff / 60)
    if minutes < 60:
        return f"{minutes} min ago"
    hours = int(minutes / 60)
    if hours < 24:
        return f"{hours}h ago"
    days = int(hours / 24)
    return f"{days}d ago"

@router.post("/crowd-reports", status_code=status.HTTP_201_CREATED)
def submit_crowd_report(
    payload: CrowdReportCreate,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    now = datetime.datetime.now(datetime.timezone.utc)
    user = get_or_create_user(db, x_user_id, payload.user_name)

    # 1. Validate destination
    dest = db.query(Destination).filter(Destination.id == payload.destination_id).first()
    if not dest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination '{payload.destination_id}' not found."
        )

    # 2. Rate limit check: 1 report per user per place every 45 minutes
    rate_limit_cutoff = now - datetime.timedelta(minutes=settings.RATE_LIMIT_MINUTES)
    recent_submission = db.query(CrowdReport).filter(
        CrowdReport.user_id == user.id,
        CrowdReport.destination_id == dest.id,
        CrowdReport.submitted_at >= rate_limit_cutoff
    ).first()

    if recent_submission:
        sub_time = recent_submission.submitted_at
        if sub_time.tzinfo is None:
            sub_time = sub_time.replace(tzinfo=datetime.timezone.utc)
        minutes_remaining = int(
            (sub_time + datetime.timedelta(minutes=settings.RATE_LIMIT_MINUTES) - now).total_seconds() / 60
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit: You have already submitted a report for {dest.name}. Please wait {max(1, minutes_remaining)} minute(s) before reporting again."
        )

    # 3. Content moderation check on tip
    mod_status, mod_reason = check_moderation(payload.tip or "")

    # 4. Snapshot forecast score
    current_hour = now.hour
    baseline_score, _ = calculate_baseline_forecast(
        base=dest.base_crowd,
        is_gem=dest.is_gem,
        hour=current_hour,
    )

    observed_time = payload.observed_at or now

    # 5. Persist report
    report = CrowdReport(
        user_id=user.id,
        destination_id=dest.id,
        crowd_level=payload.crowd_level,
        vs_forecast=payload.vs_forecast,
        wait_minutes=payload.wait_minutes or 0,
        tip=(payload.tip or "").strip(),
        observed_at=observed_time,
        submitted_at=now,
        forecast_score_at_report=baseline_score,
        moderation_status=mod_status,
        trust_weight=1.0,
        image=payload.image,
    )
    db.add(report)
    db.flush() # Flush to get report.id

    # 6. Reward points handling (server-controlled, daily cap, duplicate prevention)
    points_awarded = 0
    reward_msg = ""

    if mod_status == "approved":
        # Check daily points cap (last 24h)
        one_day_ago = now - datetime.timedelta(hours=24)
        daily_points = db.query(func.coalesce(func.sum(Reward.points), 0)).filter(
            Reward.user_id == user.id,
            Reward.created_at >= one_day_ago
        ).scalar() or 0

        if daily_points < settings.DAILY_POINTS_CAP:
            points_to_give = min(settings.POINTS_PER_CHECKIN, settings.DAILY_POINTS_CAP - daily_points)
            ref_id = f"crowd_report_{report.id}"
            
            # Check for existing reward with this reference_id
            existing_reward = db.query(Reward).filter(
                Reward.user_id == user.id,
                Reward.reference_id == ref_id
            ).first()

            if not existing_reward and points_to_give > 0:
                reward = Reward(
                    user_id=user.id,
                    points=points_to_give,
                    reason=f"Check-in at {dest.name}",
                    reference_id=ref_id,
                    created_at=now
                )
                db.add(reward)
                points_awarded = points_to_give
                reward_msg = f"Check-in shared · +{points_awarded} pts!"
        else:
            reward_msg = "Check-in shared! (Daily points cap reached: 100 pts/day)"
    else:
        reward_msg = "Report submitted and queued for moderation review."

    db.commit()
    db.refresh(report)

    # Compute updated user total points
    total_points = db.query(func.coalesce(func.sum(Reward.points), 0)).filter(
        Reward.user_id == user.id
    ).scalar() or 0

    return {
        "success": True,
        "report": {
            "id": report.id,
            "destination_id": dest.id,
            "destination_name": dest.name,
            "user_id": user.id,
            "user_name": user.username,
            "crowd_level": report.crowd_level,
            "vs_forecast": report.vs_forecast,
            "wait_minutes": report.wait_minutes,
            "tip": report.tip,
            "image": report.image,
            "observed_at": report.observed_at.isoformat(),
            "submitted_at": report.submitted_at.isoformat(),
            "forecast_score_at_report": report.forecast_score_at_report,
            "moderation_status": report.moderation_status,
            "trust_weight": report.trust_weight,
            "accuracy_votes_count": 0,
            "ago": "just now",
        },
        "points_awarded": points_awarded,
        "total_points": total_points,
        "message": reward_msg,
    }

@router.get("/crowd-reports")
def get_crowd_reports(
    destination_id: Optional[str] = None,
    limit: int = 30,
    db: Session = Depends(get_db)
):
    query = db.query(CrowdReport).join(Destination).join(User).filter(
        CrowdReport.moderation_status != "rejected"
    )
    if destination_id:
        query = query.filter(CrowdReport.destination_id == destination_id)

    reports = query.order_by(CrowdReport.submitted_at.desc()).limit(limit).all()

    now = datetime.datetime.now(datetime.timezone.utc)
    res = []
    for r in reports:
        # Count positive accuracy votes
        pos_votes = db.query(AccuracyVote).filter(
            AccuracyVote.report_id == r.id,
            AccuracyVote.vote == 1
        ).count()

        res.append({
            "id": r.id,
            "destination_id": r.destination_id,
            "destination_name": r.destination.name,
            "user_id": r.user_id,
            "user_name": r.user.username,
            "crowd_level": r.crowd_level,
            "vs_forecast": r.vs_forecast,
            "wait_minutes": r.wait_minutes,
            "tip": r.tip,
            "image": r.image,
            "observed_at": r.observed_at.isoformat(),
            "submitted_at": r.submitted_at.isoformat(),
            "forecast_score_at_report": r.forecast_score_at_report,
            "moderation_status": r.moderation_status,
            "trust_weight": round(r.trust_weight, 2),
            "accuracy_votes_count": pos_votes,
            "ago": format_relative_time(r.submitted_at, now),
        })
    return {"reports": res, "count": len(res)}

@router.get("/places/{place_id}/feed")
def get_place_feed(
    place_id: str,
    filter_type: Optional[str] = "all", # all, reports, tips
    db: Session = Depends(get_db)
):
    dest = db.query(Destination).filter(Destination.id == place_id).first()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")

    query = db.query(CrowdReport).filter(
        CrowdReport.destination_id == place_id,
        CrowdReport.moderation_status != "rejected"
    )

    if filter_type == "tips":
        query = query.filter(CrowdReport.tip != "", CrowdReport.tip.isnot(None))

    reports = query.order_by(CrowdReport.submitted_at.desc()).limit(25).all()
    now = datetime.datetime.now(datetime.timezone.utc)

    items = []
    for r in reports:
        pos_votes = db.query(AccuracyVote).filter(
            AccuracyVote.report_id == r.id,
            AccuracyVote.vote == 1
        ).count()

        items.append({
            "id": r.id,
            "destination_id": dest.id,
            "destination_name": dest.name,
            "user_id": r.user_id,
            "user_name": r.user.username,
            "crowd_level": r.crowd_level,
            "vs_forecast": r.vs_forecast,
            "wait_minutes": r.wait_minutes,
            "tip": r.tip,
            "observed_at": r.observed_at.isoformat(),
            "submitted_at": r.submitted_at.isoformat(),
            "moderation_status": r.moderation_status,
            "trust_weight": round(r.trust_weight, 2),
            "accuracy_votes_count": pos_votes,
            "ago": format_relative_time(r.submitted_at, now),
        })

    return {
        "destination": {"id": dest.id, "name": dest.name, "hindi": dest.hindi},
        "reports": items,
        "count": len(items)
    }

@router.get("/places/{place_id}/live-crowd", response_model=LiveCrowdResponse)
def get_live_crowd(
    place_id: str,
    hour: Optional[int] = None,
    day: Optional[str] = "Sun",
    weather: Optional[str] = "clear",
    festival: Optional[bool] = False,
    db: Session = Depends(get_db)
):
    dest = db.query(Destination).filter(Destination.id == place_id).first()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")

    now = datetime.datetime.now(datetime.timezone.utc)
    target_hour = hour if hour is not None else now.hour

    baseline_score, _ = calculate_baseline_forecast(
        base=dest.base_crowd,
        is_gem=dest.is_gem,
        day=day or "Sun",
        hour=target_hour,
        festival=festival or False,
        weather=weather or "clear"
    )

    # Fetch recent reports for destination
    stale_cutoff = now - datetime.timedelta(minutes=settings.STALE_WINDOW_MINUTES)
    recent_reports = db.query(CrowdReport).filter(
        CrowdReport.destination_id == place_id,
        CrowdReport.submitted_at >= stale_cutoff
    ).all()

    adj, count, max_age, min_age, label = compute_live_crowd_adjustment(recent_reports, now=now)
    live_score = max(5, min(99, baseline_score + adj))
    level_cat = get_crowd_level_category(live_score)

    last_update = None
    if min_age is not None:
        last_update = "just now" if min_age < 1 else f"{min_age} min ago"

    return LiveCrowdResponse(
        destination_id=dest.id,
        destination_name=dest.name,
        forecast_score=baseline_score,
        live_score=live_score,
        adjustment=adj,
        report_count=count,
        last_update=last_update,
        status_label=label,
        level=level_cat
    )

@router.post("/accuracy-votes")
def submit_accuracy_vote(
    payload: AccuracyVoteCreate,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id)

    report = db.query(CrowdReport).filter(CrowdReport.id == payload.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Crowd report not found")

    # Prevent voting on own report
    if report.user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot vote on your own report.")

    existing_vote = db.query(AccuracyVote).filter(
        AccuracyVote.user_id == user.id,
        AccuracyVote.report_id == payload.report_id
    ).first()

    if existing_vote:
        raise HTTPException(status_code=400, detail="You have already voted on this report.")

    vote = AccuracyVote(
        user_id=user.id,
        report_id=payload.report_id,
        vote=payload.vote
    )
    db.add(vote)

    # Adjust report trust weight
    delta = 0.15 if payload.vote == 1 else -0.20
    report.trust_weight = max(0.2, min(2.0, report.trust_weight + delta))

    db.commit()

    total_pos_votes = db.query(AccuracyVote).filter(
        AccuracyVote.report_id == report.id,
        AccuracyVote.vote == 1
    ).count()

    return {
        "success": True,
        "report_id": report.id,
        "trust_weight": round(report.trust_weight, 2),
        "accuracy_votes_count": total_pos_votes,
        "message": "Thank you for verifying this report's accuracy!"
    }

@router.post("/reports/{report_id}/flag")
def flag_crowd_report(
    report_id: int,
    payload: Optional[ReportFlagCreate] = None,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id)
    report = db.query(CrowdReport).filter(CrowdReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Crowd report not found")

    report.moderation_status = "flagged"
    db.commit()

    return {
        "success": True,
        "report_id": report.id,
        "moderation_status": "flagged",
        "message": "Report flagged for moderation review. Thank you for keeping Musafir reliable."
    }

@router.get("/destinations", response_model=list[DestinationResponse])
def get_destinations(
    q: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Destination)
    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            func.lower(Destination.name).like(search) |
            func.lower(Destination.hindi).like(search) |
            func.lower(Destination.category).like(search) |
            func.lower(Destination.id).like(search)
        )
    return query.order_by(Destination.name.asc()).all()

@router.post("/destinations", response_model=DestinationResponse, status_code=status.HTTP_201_CREATED)
def create_destination(
    payload: DestinationCreate,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Destination name cannot be empty")
    
    # Check if a destination with identical name (case-insensitive) already exists
    existing = db.query(Destination).filter(func.lower(Destination.name) == name.lower()).first()
    if existing:
        return existing
    
    import re, uuid
    slug = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    if not slug:
        slug = f"place_{uuid.uuid4().hex[:6]}"
    
    original_slug = slug
    counter = 1
    while db.query(Destination).filter(Destination.id == slug).first():
        slug = f"{original_slug}_{counter}"
        counter += 1
    
    new_dest = Destination(
        id=slug,
        name=name,
        hindi=payload.hindi.strip() if payload.hindi else None,
        category=payload.category or "heritage",
        cost=0,
        tags=payload.tags or ["community", "hidden_gem"],
        capacity=600,
        sensitivity=payload.sensitivity or "normal",
        base_crowd=25,
        is_gem=True,
        alternatives=[]
    )
    db.add(new_dest)
    db.commit()
    db.refresh(new_dest)
    return new_dest

