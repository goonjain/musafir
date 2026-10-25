import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, Date,
    ForeignKey, UniqueConstraint, Index, JSON
)
from sqlalchemy.orm import relationship
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    username = Column(String(64), nullable=False, default="Traveller")
    role = Column(String(20), nullable=False, default="traveller") # traveller, admin
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc))

    reports = relationship("CrowdReport", back_populates="user", cascade="all, delete-orphan")
    rewards = relationship("Reward", back_populates="user", cascade="all, delete-orphan")
    votes = relationship("AccuracyVote", back_populates="user", cascade="all, delete-orphan")
    suggestions = relationship("GemSuggestion", back_populates="user", cascade="all, delete-orphan")


class Destination(Base):
    __tablename__ = "destinations"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    hindi = Column(String(100), nullable=True)
    category = Column(String(50), default="heritage")
    cost = Column(Integer, default=0)
    hours = Column(String(100), nullable=True)
    tags = Column(JSON, default=list)
    capacity = Column(Integer, default=1000)
    sensitivity = Column(String(20), default="normal") # normal or fragile
    base_crowd = Column(Integer, default=50)
    is_gem = Column(Boolean, default=False)
    alternatives = Column(JSON, default=list)

    reports = relationship("CrowdReport", back_populates="destination", cascade="all, delete-orphan")


class CrowdReport(Base):
    __tablename__ = "crowd_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    destination_id = Column(String(50), ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False, index=True)
    crowd_level = Column(String(20), nullable=False) # Quiet, Moderate, Busy, Packed
    vs_forecast = Column(String(20), nullable=True) # Quieter, About right, Busier
    wait_minutes = Column(Integer, default=0)
    tip = Column(String(200), nullable=True)
    observed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    forecast_score_at_report = Column(Integer, nullable=True)
    moderation_status = Column(String(20), nullable=False, default="approved", index=True) # approved, pending, flagged, rejected
    trust_weight = Column(Float, nullable=False, default=1.0)
    image = Column(Text, nullable=True)

    user = relationship("User", back_populates="reports")
    destination = relationship("Destination", back_populates="reports")
    accuracy_votes = relationship("AccuracyVote", back_populates="report", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_dest_status_submitted", "destination_id", "moderation_status", "submitted_at"),
        Index("idx_user_dest_submitted", "user_id", "destination_id", "submitted_at"),
    )


class AccuracyVote(Base):
    __tablename__ = "accuracy_votes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    report_id = Column(Integer, ForeignKey("crowd_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    vote = Column(Integer, nullable=False) # 1 for still accurate, -1 for not accurate
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="votes")
    report = relationship("CrowdReport", back_populates="accuracy_votes")

    __table_args__ = (
        UniqueConstraint("user_id", "report_id", name="uq_user_report_vote"),
    )


class Reward(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    points = Column(Integer, nullable=False)
    reason = Column(String(100), nullable=False)
    reference_id = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="rewards")

    __table_args__ = (
        UniqueConstraint("user_id", "reference_id", name="uq_user_reward_reference"),
    )


class GemSuggestion(Base):
    __tablename__ = "gem_suggestions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    place_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    similar_to_destination_id = Column(String(50), nullable=True)
    vibe_tags = Column(JSON, default=list)
    fragile_flag = Column(Boolean, default=False)
    photo_url = Column(String(255), nullable=True)
    status = Column(String(20), default="pending", index=True) # pending, approved, rejected
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="suggestions")


class GemConfirmation(Base):
    __tablename__ = "gem_confirmations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    gem_id = Column(String(50), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    visited_on = Column(Date, nullable=False)
    worth_it = Column(Boolean, nullable=False)
    crowd_level = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc))

    __table_args__ = (
        UniqueConstraint("gem_id", "user_id", "visited_on", name="uq_gem_user_visit"),
    )
