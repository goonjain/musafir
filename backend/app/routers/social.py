import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from backend.app.database import get_db
from backend.app.models import User, Destination, TravelPost, PostLike, PostComment
from backend.app.schemas import (
    TravelPostCreate, TravelPostResponse,
    PostCommentCreate, PostCommentResponse
)
from backend.app.services.moderation import check_moderation
from backend.app.routers.community import get_or_create_user, format_relative_time

router = APIRouter(prefix="/api", tags=["Travel Social Community"])

@router.get("/posts", response_model=list[TravelPostResponse])
def get_travel_posts(
    destination_id: Optional[str] = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    query = db.query(TravelPost).filter(TravelPost.moderation_status != "rejected")
    if destination_id and destination_id != "all":
        query = query.filter(TravelPost.destination_id == destination_id)

    posts = query.order_by(TravelPost.created_at.desc()).offset(offset).limit(limit).all()
    
    now = datetime.datetime.now(datetime.timezone.utc)
    current_user_id = x_user_id

    result = []
    for post in posts:
        likes_count = len(post.likes)
        has_liked = any(like.user_id == current_user_id for like in post.likes) if current_user_id else False
        
        # Load approved comments
        approved_comments = [
            c for c in post.comments if c.moderation_status != "rejected"
        ]
        comments_count = len(approved_comments)
        
        # Format comments
        comments_data = [
            PostCommentResponse(
                id=c.id,
                post_id=c.post_id,
                user_id=c.user_id,
                user_name=c.user.username if c.user else "Traveller",
                content=c.content,
                created_at=c.created_at,
                ago=format_relative_time(c.created_at, now),
                moderation_status=c.moderation_status,
            )
            for c in approved_comments
        ]

        result.append(
            TravelPostResponse(
                id=post.id,
                user_id=post.user_id,
                user_name=post.user.username if post.user else "Traveller",
                destination_id=post.destination_id,
                destination_name=post.destination.name if post.destination else (post.destination_id or "Jaipur"),
                title=post.title,
                content=post.content,
                image_url=post.image_url,
                created_at=post.created_at,
                ago=format_relative_time(post.created_at, now),
                moderation_status=post.moderation_status,
                likes_count=likes_count,
                has_liked=has_liked,
                comments_count=comments_count,
                comments=comments_data,
            )
        )

    return result

@router.post("/posts", response_model=TravelPostResponse, status_code=status.HTTP_201_CREATED)
def create_travel_post(
    payload: TravelPostCreate,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id, payload.user_name)

    dest = None
    if payload.destination_id and payload.destination_id != "all":
        dest = db.query(Destination).filter(Destination.id == payload.destination_id).first()
        if not dest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Destination '{payload.destination_id}' not found."
            )

    # Moderate title & content
    status_content, _ = check_moderation(payload.content)
    status_title, _ = check_moderation(payload.title or "")
    mod_status = "flagged" if (status_content == "flagged" or status_title == "flagged") else "approved"

    post = TravelPost(
        user_id=user.id,
        destination_id=dest.id if dest else None,
        title=payload.title.strip() if payload.title else None,
        content=payload.content.strip(),
        image_url=payload.image_url,
        moderation_status=mod_status,
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    now = datetime.datetime.now(datetime.timezone.utc)
    return TravelPostResponse(
        id=post.id,
        user_id=post.user_id,
        user_name=user.username,
        destination_id=post.destination_id,
        destination_name=dest.name if dest else "Jaipur",
        title=post.title,
        content=post.content,
        image_url=post.image_url,
        created_at=post.created_at,
        ago=format_relative_time(post.created_at, now),
        moderation_status=post.moderation_status,
        likes_count=0,
        has_liked=False,
        comments_count=0,
        comments=[],
    )

@router.post("/posts/{post_id}/like")
def toggle_post_like(
    post_id: int,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id)
    post = db.query(TravelPost).filter(TravelPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Travel post not found.")

    existing_like = db.query(PostLike).filter(
        PostLike.user_id == user.id,
        PostLike.post_id == post.id
    ).first()

    if existing_like:
        # Unlike
        db.delete(existing_like)
        db.commit()
        liked = False
    else:
        # Like
        try:
            new_like = PostLike(
                user_id=user.id,
                post_id=post.id,
                created_at=datetime.datetime.now(datetime.timezone.utc),
            )
            db.add(new_like)
            db.commit()
            liked = True
        except Exception:
            db.rollback()
            liked = True

    likes_count = db.query(PostLike).filter(PostLike.post_id == post.id).count()
    return {
        "success": True,
        "post_id": post.id,
        "liked": liked,
        "likes_count": likes_count,
    }

@router.get("/posts/{post_id}/comments", response_model=list[PostCommentResponse])
def get_post_comments(
    post_id: int,
    db: Session = Depends(get_db),
):
    post = db.query(TravelPost).filter(TravelPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Travel post not found.")

    comments = db.query(PostComment).filter(
        PostComment.post_id == post.id,
        PostComment.moderation_status != "rejected"
    ).order_by(PostComment.created_at.asc()).all()

    now = datetime.datetime.now(datetime.timezone.utc)
    return [
        PostCommentResponse(
            id=c.id,
            post_id=c.post_id,
            user_id=c.user_id,
            user_name=c.user.username if c.user else "Traveller",
            content=c.content,
            created_at=c.created_at,
            ago=format_relative_time(c.created_at, now),
            moderation_status=c.moderation_status,
        )
        for c in comments
    ]

@router.post("/posts/{post_id}/comments", response_model=PostCommentResponse, status_code=status.HTTP_201_CREATED)
def create_post_comment(
    post_id: int,
    payload: PostCommentCreate,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    user = get_or_create_user(db, x_user_id, payload.user_name)
    post = db.query(TravelPost).filter(TravelPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Travel post not found.")

    mod_status, _ = check_moderation(payload.content)

    comment = PostComment(
        user_id=user.id,
        post_id=post.id,
        content=payload.content.strip(),
        moderation_status=mod_status,
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    now = datetime.datetime.now(datetime.timezone.utc)
    return PostCommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        user_name=user.username,
        content=comment.content,
        created_at=comment.created_at,
        ago=format_relative_time(comment.created_at, now),
        moderation_status=comment.moderation_status,
    )
