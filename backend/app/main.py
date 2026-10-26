import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from sqlalchemy import text
from backend.app.config import settings
from backend.app.database import engine, Base, SessionLocal
from backend.app.models import Destination, User
from backend.app.routers import community, rewards, gems, admin, legacy_compat, social

CANONICAL_DESTINATIONS = [
    {"id": "amber", "name": "Amber Fort", "hindi": "आमेर किला", "tags": ["heritage", "photography"], "base_crowd": 62, "cost": 200, "is_gem": False, "alternatives": ["jaigarh", "panna", "jagat_shiromani", "gatore"], "capacity": 1800, "sensitivity": "normal"},
    {"id": "nahargarh", "name": "Nahargarh Fort", "hindi": "नाहरगढ़ किला", "tags": ["heritage", "nature", "photography"], "base_crowd": 50, "cost": 200, "is_gem": False, "alternatives": ["jaigarh", "gatore", "jalmahal"], "capacity": 1200, "sensitivity": "normal"},
    {"id": "jalmahal", "name": "Jal Mahal", "hindi": "जल महल", "tags": ["photography", "nature"], "base_crowd": 40, "cost": 0, "is_gem": False, "alternatives": ["kanak", "vidyadhar", "sisodia"], "capacity": 800, "sensitivity": "normal"},
    {"id": "hawa", "name": "Hawa Mahal", "hindi": "हवा महल", "tags": ["heritage", "photography", "shopping"], "base_crowd": 58, "cost": 50, "is_gem": False, "alternatives": ["albert", "gatore", "patrika"], "capacity": 1000, "sensitivity": "normal"},
    {"id": "jantar", "name": "Jantar Mantar", "hindi": "जंतर मंतर", "tags": ["heritage"], "base_crowd": 48, "cost": 50, "is_gem": False, "alternatives": ["citypalace", "anokhi", "jkk"], "capacity": 900, "sensitivity": "normal"},
    {"id": "citypalace", "name": "City Palace", "hindi": "सिटी पैलेस", "tags": ["heritage", "photography"], "base_crowd": 45, "cost": 300, "is_gem": False, "alternatives": ["albert", "gatore", "jkk"], "capacity": 1500, "sensitivity": "normal"},
    {"id": "bapu", "name": "Bapu Bazaar", "hindi": "बापू बाज़ार", "tags": ["shopping", "food"], "base_crowd": 55, "cost": 0, "is_gem": False, "alternatives": ["tripolia", "sanganer"], "capacity": 2000, "sensitivity": "normal"},
    {"id": "jaigarh", "name": "Jaigarh Fort", "hindi": "जयगढ़ किला", "tags": ["heritage", "photography", "nature"], "base_crowd": 30, "cost": 150, "is_gem": True, "alternatives": [], "capacity": 600, "sensitivity": "normal"},
    {"id": "panna", "name": "Panna Meena Kund", "hindi": "पन्ना मीणा कुंड", "tags": ["photography", "heritage"], "base_crowd": 18, "cost": 0, "is_gem": True, "alternatives": [], "capacity": 200, "sensitivity": "fragile"},
    {"id": "jagat_shiromani", "name": "Jagat Shiromani Temple", "hindi": "जगत शिरोमणि मंदिर", "tags": ["heritage", "photography"], "base_crowd": 14, "cost": 0, "is_gem": True, "alternatives": [], "capacity": 250, "sensitivity": "fragile"},
    {"id": "gatore", "name": "Royal Gaitor Tirth", "hindi": "गैटोर की छतरियां", "tags": ["heritage", "photography"], "base_crowd": 16, "cost": 30, "is_gem": True, "alternatives": [], "capacity": 300, "sensitivity": "fragile"},
    {"id": "kanak", "name": "Kanak Ghati", "hindi": "कनक घाटी", "tags": ["nature", "photography"], "base_crowd": 15, "cost": 0, "is_gem": True, "alternatives": [], "capacity": 300, "sensitivity": "fragile"},
    {"id": "albert", "name": "Albert Hall Museum", "hindi": "अल्बर्ट हॉल", "tags": ["heritage", "photography"], "base_crowd": 28, "cost": 40, "is_gem": True, "alternatives": [], "capacity": 500, "sensitivity": "normal"},
    {"id": "patrika", "name": "Patrika Gate", "hindi": "पत्रिका गेट", "tags": ["photography"], "base_crowd": 25, "cost": 0, "is_gem": True, "alternatives": [], "capacity": 400, "sensitivity": "fragile"},
    {"id": "tripolia", "name": "Tripolia Bazaar", "hindi": "त्रिपोलिया बाज़ार", "tags": ["shopping"], "base_crowd": 30, "cost": 0, "is_gem": True, "alternatives": [], "capacity": 700, "sensitivity": "normal"},
    {"id": "anokhi", "name": "Anokhi Museum", "hindi": "अनोखी संग्रहालय", "tags": ["heritage", "shopping"], "base_crowd": 12, "cost": 80, "is_gem": True, "alternatives": [], "capacity": 150, "sensitivity": "fragile"},
    {"id": "sisodia", "name": "Sisodia Rani Garden", "hindi": "सिसोदिया रानी बाग", "tags": ["nature", "photography", "heritage"], "base_crowd": 22, "cost": 50, "is_gem": True, "alternatives": [], "capacity": 400, "sensitivity": "normal"},
    {"id": "vidyadhar", "name": "Vidyadhar Garden", "hindi": "विद्याधर बाग", "tags": ["nature", "heritage", "photography"], "base_crowd": 18, "cost": 20, "is_gem": True, "alternatives": [], "capacity": 350, "sensitivity": "normal"},
    {"id": "galtaji", "name": "Galtaji Temple", "hindi": "गलता जी तीर्थ", "tags": ["heritage", "nature", "photography"], "base_crowd": 22, "cost": 0, "is_gem": True, "alternatives": [], "capacity": 450, "sensitivity": "normal"},
    {"id": "sanganer", "name": "Sanganer Craft Area", "hindi": "सांगानेर", "tags": ["shopping", "photography"], "base_crowd": 15, "cost": 0, "is_gem": True, "alternatives": [], "capacity": 300, "sensitivity": "normal"},
    {"id": "jkk", "name": "Jawahar Kala Kendra", "hindi": "जवाहर कला केंद्र", "tags": ["cafes", "heritage", "photography"], "base_crowd": 24, "cost": 0, "is_gem": True, "alternatives": [], "capacity": 500, "sensitivity": "normal"},
]

def seed_destinations():
    db = SessionLocal()
    try:
        existing = {d.id: d for d in db.query(Destination).all()}
        for item in CANONICAL_DESTINATIONS:
            if item["id"] not in existing:
                dest = Destination(
                    id=item["id"],
                    name=item["name"],
                    hindi=item["hindi"],
                    tags=item["tags"],
                    base_crowd=item["base_crowd"],
                    cost=item["cost"],
                    is_gem=item["is_gem"],
                    alternatives=item["alternatives"],
                    capacity=item["capacity"],
                    sensitivity=item["sensitivity"],
                )
                db.add(dest)
        db.commit()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("TESTING") != "1" and not getattr(app.state, "testing", False):
        # Initialize DB schema
        Base.metadata.create_all(bind=engine)
        # Safe migration: ensure image column exists
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE crowd_reports ADD COLUMN image TEXT"))
                conn.commit()
        except Exception:
            pass
        # Seed destination foundation
        seed_destinations()
    yield

app = FastAPI(
    title="Musafir Community API",
    description="Real, database-backed community crowd reporting, forecasting, and reward engine for Jaipur.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(community.router)
app.include_router(social.router)
app.include_router(rewards.router)
app.include_router(gems.router)
app.include_router(admin.router)
app.include_router(legacy_compat.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
