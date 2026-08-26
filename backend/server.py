from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ============================================================
# MULEH — Database Schema
# Collections:
#   navigation_sessions : one document per recorded walk/route
#   track_points        : ordered GPS/relative points belonging to a session
# ============================================================

class GeoPoint(BaseModel):
    """A single coordinate captured by the device."""
    latitude: float
    longitude: float
    altitude: Optional[float] = None  # meters, if available
    accuracy: Optional[float] = None  # meters, GPS accuracy radius


class TrackPoint(BaseModel):
    """One breadcrumb point along a recorded route (stored in `track_points`)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str  # -> NavigationSession.id
    sequence: int  # order of the point within the session (0-based)
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    heading: Optional[float] = None  # degrees 0-360, device heading at capture
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TrackPointCreate(BaseModel):
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    recorded_at: Optional[datetime] = None


class NavigationSession(BaseModel):
    """A recording session: starts when the user taps START RECORDING
    (stored in `navigation_sessions`)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None  # optional label, e.g. "Parkiran Mall"
    status: Literal["recording", "completed"] = "recording"
    start_point: GeoPoint  # the origin the user wants to return to
    point_count: int = 0  # denormalized count of track points
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None


class NavigationSessionCreate(BaseModel):
    name: Optional[str] = None
    start_point: GeoPoint


# Ensure indexes for fast lookups (session ordering + per-session points)
@app.on_event("startup")
async def ensure_indexes():
    await db.navigation_sessions.create_index([("started_at", -1)])
    await db.navigation_sessions.create_index([("status", 1)])
    await db.track_points.create_index([("session_id", 1), ("sequence", 1)])


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


# ============================================================
# MULEH — Navigation Session & Track Point APIs
# ============================================================

@api_router.post("/sessions", response_model=NavigationSession)
async def create_session(input: NavigationSessionCreate):
    """Start a new navigation recording session (user taps START RECORDING)."""
    session = NavigationSession(**input.dict())
    await db.navigation_sessions.insert_one(session.dict())
    return session


@api_router.post("/sessions/{session_id}/points", response_model=TrackPoint)
async def add_track_point(session_id: str, input: TrackPointCreate):
    """Append one track point (breadcrumb) to a recording session."""
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "recording":
        raise HTTPException(status_code=400, detail="Session is not recording")

    data = input.dict()
    if data.get("recorded_at") is None:
        data["recorded_at"] = datetime.now(timezone.utc)
    point = TrackPoint(session_id=session_id, sequence=session["point_count"], **data)
    await db.track_points.insert_one(point.dict())
    await db.navigation_sessions.update_one(
        {"id": session_id}, {"$inc": {"point_count": 1}}
    )
    return point


class TrackPointBatchCreate(BaseModel):
    points: List[TrackPointCreate]


@api_router.post("/sessions/{session_id}/points/batch", response_model=List[TrackPoint])
async def add_track_points_batch(session_id: str, input: TrackPointBatchCreate):
    """Append multiple track points at once (background tracking flushes in batches)."""
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "recording":
        raise HTTPException(status_code=400, detail="Session is not recording")
    if not input.points:
        return []

    start_seq = session["point_count"]
    points = []
    for offset, p in enumerate(input.points):
        data = p.dict()
        if data.get("recorded_at") is None:
            data["recorded_at"] = datetime.now(timezone.utc)
        points.append(TrackPoint(session_id=session_id, sequence=start_seq + offset, **data))
    await db.track_points.insert_many([pt.dict() for pt in points])
    await db.navigation_sessions.update_one(
        {"id": session_id}, {"$inc": {"point_count": len(points)}}
    )
    return points


class SessionRoute(BaseModel):
    """Full route payload for the AR view: session info, its start point
    and every track point in recorded order."""
    session: NavigationSession
    start_point: GeoPoint
    points: List[TrackPoint]


@api_router.get("/sessions/{session_id}/route", response_model=SessionRoute)
async def get_session_route(session_id: str):
    """Fetch the complete route of a session (start point + ordered track points)."""
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    points = (
        await db.track_points.find({"session_id": session_id})
        .sort("sequence", 1)
        .to_list(10000)
    )
    session_obj = NavigationSession(**session)
    return SessionRoute(
        session=session_obj,
        start_point=session_obj.start_point,
        points=[TrackPoint(**p) for p in points],
    )

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
