import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.database import get_db
from backend.app.models import Destination, GemSuggestion, GemConfirmation
from backend.app.routers.community import get_or_create_user
from backend.app.schemas import (
    GemSuggestionCreate, GemSuggestionResponse, GemConfirmationCreate
)
from backend.app.services.crowd_engine import calculate_baseline_forecast

router = APIRouter(prefix="/api", tags=["Hidden Gems"])

@router.post("/gem-suggestions", status_code=status.HTTP_201_CREATED)
def submit_gem_suggestion(
    payload: GemSuggestionCreate,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id)

    suggestion = GemSuggestion(
        user_id=user.id,
        place_name=payload.place_name.strip(),
        description=payload.description.strip(),
        similar_to_destination_id=payload.similar_to_destination_id,
        vibe_tags=payload.vibe_tags,
        fragile_flag=payload.fragile_flag,
        photo_url=payload.photo_url,
        status="pending",
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)

    return {
        "success": True,
        "suggestion_id": suggestion.id,
        "status": suggestion.status,
        "message": "Your hidden gem suggestion has been submitted privately to our curating team. Points (+50) are awarded once verified!"
    }

@router.get("/gem-suggestions/mine")
def get_my_gem_suggestions(
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id)
    suggestions = db.query(GemSuggestion).filter(
        GemSuggestion.user_id == user.id
    ).order_by(GemSuggestion.created_at.desc()).all()

    return {
        "suggestions": [
            {
                "id": s.id,
                "place_name": s.place_name,
                "description": s.description,
                "similar_to_destination_id": s.similar_to_destination_id,
                "vibe_tags": s.vibe_tags,
                "fragile_flag": s.fragile_flag,
                "status": s.status,
                "created_at": s.created_at.isoformat()
            } for s in suggestions
        ]
    }

@router.get("/places/{place_id}/alternatives")
def get_place_alternatives(
    place_id: str,
    db: Session = Depends(get_db)
):
    """
    On-demand disclosure: Returns 2 or 3 curated alternatives matching vibe and crowd room.
    No endpoint returns the full list of gems.
    """
    dest = db.query(Destination).filter(Destination.id == place_id).first()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")

    alt_ids = dest.alternatives or []
    if not alt_ids:
        # Fallback to general low-crowd gems
        gems = db.query(Destination).filter(Destination.is_gem == True).limit(2).all()
    else:
        gems = db.query(Destination).filter(Destination.id.in_(alt_ids)).all()

    now = datetime.datetime.now(datetime.timezone.utc)
    results = []
    dest_tags = set(dest.tags or [])

    for g in gems:
        score, _ = calculate_baseline_forecast(base=g.base_crowd, is_gem=g.is_gem, hour=now.hour)
        
        # If fragile gem is already crowded, omit it per doc
        if g.sensitivity == "fragile" and score > 55:
            continue

        g_tags = set(g.tags or [])
        shared = dest_tags.intersection(g_tags)
        match_pct = round((len(shared) / max(len(dest_tags), 1)) * 40 + 55)

        # Count 12-month unique visitors
        one_year_ago = now.date() - datetime.timedelta(days=365)
        confirmations_count = db.query(GemConfirmation).filter(
            GemConfirmation.gem_id == g.id,
            GemConfirmation.visited_on >= one_year_ago
        ).count()

        status_tag = f"Confirmed by {confirmations_count} travellers this year" if confirmations_count > 0 else "New gem, first-year data pending"

        results.append({
            "id": g.id,
            "name": g.name,
            "hindi": g.hindi,
            "score": score,
            "vibe_match_percent": min(match_pct, 98),
            "status_tag": status_tag,
            "room_left_score": max(5, 100 - score),
            "tags": g.tags,
            "sensitivity": g.sensitivity,
        })

    return {
        "primary_destination": dest.name,
        "alternatives": results[:3]
    }

@router.post("/gems/{gem_id}/confirmations")
def confirm_gem_visit(
    gem_id: str,
    payload: GemConfirmationCreate,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id)
    today = datetime.datetime.now(datetime.timezone.utc).date()

    existing = db.query(GemConfirmation).filter(
        GemConfirmation.gem_id == gem_id,
        GemConfirmation.user_id == user.id,
        GemConfirmation.visited_on == today
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="You have already confirmed this place for today.")

    confirmation = GemConfirmation(
        gem_id=gem_id,
        user_id=user.id,
        visited_on=today,
        worth_it=payload.worth_it,
        crowd_level=payload.crowd_level,
    )
    db.add(confirmation)
    db.commit()

    return {
        "success": True,
        "message": "Thank you for confirming this gem! Your observation keeps the community accurate."
    }
