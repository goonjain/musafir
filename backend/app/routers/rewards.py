import datetime
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from backend.app.database import get_db
from backend.app.models import Reward
from backend.app.routers.community import get_or_create_user
from backend.app.schemas import RewardBalanceResponse, RewardItem
from backend.app.config import settings

router = APIRouter(prefix="/api/rewards", tags=["Rewards"])

BADGE_DEFINITIONS = [
    {"name": "Hidden Gem Hunter", "need": 80, "icon": "💎", "description": "Contributed crowd insights or explored quiet gems"},
    {"name": "Smart Explorer", "need": 120, "icon": "🧭", "description": "Helped the community avoid peak rush hours"},
    {"name": "Crowd Navigator", "need": 200, "icon": "🐘", "description": "Trusted local guide helping keep Jaipur crowd forecasts accurate"},
]

@router.get("/balance", response_model=RewardBalanceResponse)
def get_reward_balance(
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id)
    now = datetime.datetime.now(datetime.timezone.utc)

    total_points = db.query(func.coalesce(func.sum(Reward.points), 0)).filter(
        Reward.user_id == user.id
    ).scalar() or 0

    one_day_ago = now - datetime.timedelta(hours=24)
    daily_points = db.query(func.coalesce(func.sum(Reward.points), 0)).filter(
        Reward.user_id == user.id,
        Reward.created_at >= one_day_ago
    ).scalar() or 0

    badges = []
    for b in BADGE_DEFINITIONS:
        badges.append({
            "name": b["name"],
            "need": b["need"],
            "icon": b["icon"],
            "description": b["description"],
            "unlocked": total_points >= b["need"],
        })

    recent_txs = db.query(Reward).filter(
        Reward.user_id == user.id
    ).order_by(Reward.created_at.desc()).limit(15).all()

    return RewardBalanceResponse(
        user_id=user.id,
        total_points=total_points,
        daily_points_today=daily_points,
        daily_cap=settings.DAILY_POINTS_CAP,
        badges=badges,
        recent_transactions=[
            RewardItem(
                id=tx.id,
                points=tx.points,
                reason=tx.reason,
                reference_id=tx.reference_id,
                created_at=tx.created_at
            ) for tx in recent_txs
        ]
    )
