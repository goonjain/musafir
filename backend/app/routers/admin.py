import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Literal

from backend.app.database import get_db
from backend.app.models import CrowdReport, GemSuggestion, Reward
from backend.app.config import settings

router = APIRouter(prefix="/api/admin", tags=["Admin Moderation"])

def verify_admin(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    if not x_admin_token or x_admin_token != settings.ADMIN_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Valid admin token required."
        )

class ModerationAction(BaseModel):
    status: Literal["approved", "rejected", "flagged"]
    notes: Optional[str] = None

class GemSuggestionAction(BaseModel):
    status: Literal["approved", "rejected"]
    capacity: Optional[int] = 500
    sensitivity: Optional[Literal["normal", "fragile"]] = "normal"
    notes: Optional[str] = None

@router.get("/reports", dependencies=[Depends(verify_admin)])
def get_moderation_queue(
    status_filter: Optional[str] = "flagged",
    db: Session = Depends(get_db)
):
    query = db.query(CrowdReport)
    if status_filter != "all":
        query = query.filter(CrowdReport.moderation_status == status_filter)
    
    reports = query.order_by(CrowdReport.submitted_at.desc()).limit(50).all()
    return {
        "reports": [
            {
                "id": r.id,
                "destination_id": r.destination_id,
                "user_id": r.user_id,
                "crowd_level": r.crowd_level,
                "tip": r.tip,
                "moderation_status": r.moderation_status,
                "submitted_at": r.submitted_at.isoformat(),
                "trust_weight": r.trust_weight,
            } for r in reports
        ]
    }

@router.patch("/reports/{report_id}", dependencies=[Depends(verify_admin)])
def moderate_report(
    report_id: int,
    action: ModerationAction,
    db: Session = Depends(get_db)
):
    report = db.query(CrowdReport).filter(CrowdReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    old_status = report.moderation_status
    report.moderation_status = action.status

    # If rejected, retract reward if one was given
    if action.status == "rejected":
        ref_id = f"crowd_report_{report.id}"
        reward = db.query(Reward).filter(
            Reward.user_id == report.user_id,
            Reward.reference_id == ref_id
        ).first()
        if reward:
            db.delete(reward)

    db.commit()
    return {
        "success": True,
        "report_id": report.id,
        "old_status": old_status,
        "new_status": report.moderation_status,
    }

@router.get("/gem-suggestions", dependencies=[Depends(verify_admin)])
def get_gem_suggestions_queue(
    db: Session = Depends(get_db)
):
    suggestions = db.query(GemSuggestion).order_by(
        GemSuggestion.created_at.desc()
    ).all()

    return {
        "suggestions": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "place_name": s.place_name,
                "description": s.description,
                "similar_to": s.similar_to_destination_id,
                "vibe_tags": s.vibe_tags,
                "fragile": s.fragile_flag,
                "status": s.status,
                "created_at": s.created_at.isoformat(),
            } for s in suggestions
        ]
    }

@router.patch("/gem-suggestions/{suggestion_id}", dependencies=[Depends(verify_admin)])
def review_gem_suggestion(
    suggestion_id: int,
    action: GemSuggestionAction,
    db: Session = Depends(get_db)
):
    suggestion = db.query(GemSuggestion).filter(GemSuggestion.id == suggestion_id).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion.status = action.status
    now = datetime.datetime.now(datetime.timezone.utc)

    # If approved, award persistent points to the contributor
    if action.status == "approved":
        ref_id = f"gem_suggestion_{suggestion.id}"
        existing_reward = db.query(Reward).filter(
            Reward.user_id == suggestion.user_id,
            Reward.reference_id == ref_id
        ).first()

        if not existing_reward:
            reward = Reward(
                user_id=suggestion.user_id,
                points=settings.POINTS_FOR_GEM_APPROVAL,
                reason=f"Approved hidden gem suggestion: {suggestion.place_name}",
                reference_id=ref_id,
                created_at=now,
            )
            db.add(reward)

    db.commit()
    return {
        "success": True,
        "suggestion_id": suggestion.id,
        "status": suggestion.status,
        "points_awarded": settings.POINTS_FOR_GEM_APPROVAL if action.status == "approved" else 0
    }
