from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal
from datetime import datetime

class CrowdReportCreate(BaseModel):
    destination_id: str = Field(..., min_length=1, max_length=50, description="Canonical destination ID")
    crowd_level: Literal["Quiet", "Moderate", "Busy", "Packed"] = Field(..., description="Observed crowd condition")
    vs_forecast: Optional[Literal["Quieter", "About right", "Busier"]] = Field(None, description="Comparison with forecast")
    wait_minutes: Optional[int] = Field(0, ge=0, le=360, description="Queue wait in minutes")
    tip: Optional[str] = Field("", max_length=200, description="One-line travel tip")
    image: Optional[str] = Field(None, description="Optional photo upload (base64 data URL or photo URL)")
    observed_at: Optional[datetime] = Field(None, description="Time of visit, defaults to current time")
    user_name: Optional[str] = Field(None, max_length=50, description="Optional display name for contributor")

class CrowdReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    destination_id: str
    destination_name: str
    user_id: str
    user_name: str
    crowd_level: str
    vs_forecast: Optional[str] = None
    wait_minutes: int = 0
    tip: Optional[str] = ""
    image: Optional[str] = None
    observed_at: datetime
    submitted_at: datetime
    forecast_score_at_report: Optional[int] = None
    moderation_status: str
    trust_weight: float
    accuracy_votes_count: int = 0
    ago: str = ""

class LiveCrowdResponse(BaseModel):
    destination_id: str
    destination_name: str
    forecast_score: int
    live_score: int
    adjustment: int
    report_count: int
    last_update: Optional[str] = None
    status_label: str
    level: str

class AccuracyVoteCreate(BaseModel):
    report_id: int = Field(..., description="Report ID to vote on")
    vote: Literal[1, -1] = Field(1, description="1 for still accurate, -1 for no longer accurate")

class ReportFlagCreate(BaseModel):
    reason: Optional[str] = Field("inappropriate", max_length=200)

class GemSuggestionCreate(BaseModel):
    place_name: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., min_length=5, max_length=1000)
    similar_to_destination_id: Optional[str] = Field(None, max_length=50)
    vibe_tags: list[str] = Field(default_factory=list)
    fragile_flag: bool = Field(False)
    photo_url: Optional[str] = Field(None, max_length=255)

class GemSuggestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    place_name: str
    description: str
    similar_to_destination_id: Optional[str]
    vibe_tags: list[str]
    fragile_flag: bool
    photo_url: Optional[str]
    status: str
    created_at: datetime

class GemConfirmationCreate(BaseModel):
    gem_id: str = Field(..., min_length=1, max_length=50)
    worth_it: bool = Field(...)
    crowd_level: Optional[str] = Field(None, max_length=20)

class RewardItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    points: int
    reason: str
    reference_id: str
    created_at: datetime

class RewardBalanceResponse(BaseModel):
    user_id: str
    total_points: int
    daily_points_today: int
    daily_cap: int
    badges: list[dict]
    recent_transactions: list[RewardItem]


class DestinationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    hindi: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field("heritage", max_length=50)
    tags: Optional[list[str]] = Field(default_factory=list)
    sensitivity: Optional[Literal["normal", "fragile"]] = "normal"


class DestinationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    hindi: Optional[str] = None
    category: Optional[str] = "heritage"
    cost: int = 0
    hours: Optional[str] = None
    tags: list[str] = []
    capacity: int = 1000
    sensitivity: str = "normal"
    base_crowd: int = 50
    is_gem: bool = False
    alternatives: list[str] = []


class PostCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
    user_name: Optional[str] = Field(None, max_length=50)


class PostCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    user_id: str
    user_name: str
    content: str
    created_at: datetime
    ago: str = ""
    moderation_status: str


class TravelPostCreate(BaseModel):
    destination_id: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=150)
    content: str = Field(..., min_length=3, max_length=2000)
    image_url: Optional[str] = Field(None)
    user_name: Optional[str] = Field(None, max_length=50)


class TravelPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    user_name: str
    destination_id: Optional[str] = None
    destination_name: Optional[str] = None
    title: Optional[str] = None
    content: str
    image_url: Optional[str] = None
    created_at: datetime
    ago: str = ""
    moderation_status: str
    likes_count: int = 0
    has_liked: bool = False
    comments_count: int = 0
    comments: list[PostCommentResponse] = []

