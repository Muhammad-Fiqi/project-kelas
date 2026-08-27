import math

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt

from route_builder import RawReading, build_route  # noqa: E402


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
#   sensor_readings     : raw IMU sensor samples per session
#   user_trials         : per-device trial period tracking
# ============================================================

class GeoPoint(BaseModel):
    """A single coordinate captured by the device."""
    latitude: float
    longitude: float
    altitude: Optional[float] = None  # meters, if available
    accuracy: Optional[float] = None  # meters, GPS accuracy radius


class TrackPoint(BaseModel):
    """One breadcrumb point along a recorded route (stored in `track_points`).

    Supports two tracking modes:
      - ``gps``: latitude/longitude required, relative fields optional.
      - ``imu``: relative_x/relative_y required, lat/lon optional.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str  # -> NavigationSession.id
    sequence: int  # order of the point within the session (0-based)
    # GPS mode fields
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    heading: Optional[float] = None  # degrees 0-360, device heading at capture
    # IMU mode fields (relative to session start point)
    relative_x: Optional[float] = None  # meters, east displacement
    relative_y: Optional[float] = None  # meters, north displacement
    relative_z: Optional[float] = None  # meters, vertical displacement
    relative_heading: Optional[float] = None  # degrees, heading relative to start
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TrackPointCreate(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    relative_x: Optional[float] = None
    relative_y: Optional[float] = None
    relative_z: Optional[float] = None
    relative_heading: Optional[float] = None
    recorded_at: Optional[datetime] = None


class NavigationSession(BaseModel):
    """A recording session: starts when the user taps START RECORDING
    (stored in `navigation_sessions`)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None  # optional label, e.g. "Parkiran Mall"
    status: Literal["recording", "completed"] = "recording"
    tracking_mode: Literal["gps", "imu"] = "imu"  # default: IMU-only (no GPS)
    start_point: GeoPoint  # the origin the user wants to return to
    point_count: int = 0  # denormalized count of track points
    reading_count: int = 0  # denormalized count of sensor readings
    estimated_turns: int = 0  # computed on save
    elevation_gain_m: float = 0.0  # computed on save
    floor_changes: int = 0  # computed on save
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None


class NavigationSessionCreate(BaseModel):
    name: Optional[str] = None
    tracking_mode: Literal["gps", "imu"] = "imu"
    start_point: GeoPoint


# ============================================================
# MULEH — Sensor Reading Models (raw IMU data from device)
# ============================================================

class IMUSample(BaseModel):
    """One sample of 3-axis IMU data."""
    x: float
    y: float
    z: float


class SensorReading(BaseModel):
    """Raw sensor reading captured by the device during background recording.
    Stored in `sensor_readings` collection."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str  # -> NavigationSession.id
    sequence: int  # order within the session (0-based, monotonically increasing)
    accelerometer: IMUSample  # m/s^2
    gyroscope: IMUSample  # rad/s
    magnetometer: Optional[IMUSample] = None  # μT (micro-tesla)
    pressure: Optional[float] = None  # hPa (barometer for floor detection)
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SensorReadingCreate(BaseModel):
    accelerometer: IMUSample
    gyroscope: IMUSample
    magnetometer: Optional[IMUSample] = None
    pressure: Optional[float] = None
    recorded_at: Optional[datetime] = None


class SensorReadingBatchCreate(BaseModel):
    readings: List[SensorReadingCreate]


# Ensure indexes for fast lookups (session ordering + per-session points)
@app.on_event("startup")
async def ensure_indexes():
    # --- navigation_sessions ---
    await db.navigation_sessions.create_index([("started_at", -1)])
    await db.navigation_sessions.create_index([("status", 1)])
    await db.navigation_sessions.create_index([("status", 1), ("started_at", -1)])
    await db.navigation_sessions.create_index([("name", 1)])  # name search for history
    await db.navigation_sessions.create_index([("tracking_mode", 1)])  # filter by mode

    # --- track_points ---
    await db.track_points.create_index([("session_id", 1), ("sequence", 1)])
    await db.track_points.create_index([("session_id", 1)])  # for count queries

    # --- sensor_readings ---
    await db.sensor_readings.create_index([("session_id", 1), ("sequence", 1)])
    await db.sensor_readings.create_index([("session_id", 1)])  # for count queries

    # --- user_trials ---
    await db.user_trials.create_index([("device_id", 1)], unique=True)  # one trial per device
    await db.user_trials.create_index([("status", 1)])  # filter by status

    # --- licenses ---
    await db.licenses.create_index([("device_id", 1), ("created_at", -1)])  # latest license per device
    await db.licenses.create_index([("purchase_token", 1)], sparse=True)  # dedup purchases
    await db.licenses.create_index([("status", 1)])  # filter by status

    # --- accounts ---
    await db.accounts.create_index([("email", 1)], unique=True)  # unique email
    await db.accounts.create_index([("status", 1)])  # filter by status
    logger.info("Database indexes ensured")


# ============================================================
# MULEH — Account Models (email, password, status)
# ============================================================

class Account(BaseModel):
    """User account for authentication.

    Stored in `accounts` collection. Links to device trials via device_ids.
    One account can have multiple devices (e.g. phone + tablet).
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str  # unique, lowercase
    password_hash: str  # bcrypt hash
    display_name: Optional[str] = None
    status: Literal["active", "suspended", "deleted"] = "active"
    device_ids: List[str] = Field(default_factory=list)  # linked devices
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login_at: Optional[datetime] = None


class AccountCreate(BaseModel):
    """Input for account registration."""
    email: str
    password: str  # plain text, will be hashed
    display_name: Optional[str] = None
    device_id: Optional[str] = None  # auto-link device on registration


class AccountLoginInput(BaseModel):
    """Input for account login."""
    email: str
    password: str
    device_id: Optional[str] = None  # auto-link device on login


class AccountResponse(BaseModel):
    """Public account response (never exposes password_hash)."""
    id: str
    email: str
    display_name: Optional[str] = None
    status: str
    device_ids: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


# ============================================================
# MULEH — License Models (purchase/license records)
# ============================================================

class License(BaseModel):
    """Stores a purchased license for a device.

    Created after successful Google Play purchase verification.
    One device can have multiple license records (renewals), but
    only the latest active one matters for access control.
    Stored in `licenses` collection.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    source: Literal["google_play", "manual"] = "google_play"
    product_id: str
    purchase_token: Optional[str] = None  # Google Play purchase token
    order_id: Optional[str] = None  # Google Play order ID
    status: Literal["active", "revoked", "expired"] = "active"
    purchased_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: Optional[datetime] = None  # null = lifetime license
    revoked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LicenseCreate(BaseModel):
    device_id: str
    source: Literal["google_play", "manual"] = "google_play"
    product_id: str
    purchase_token: Optional[str] = None
    order_id: Optional[str] = None
    valid_until: Optional[datetime] = None


class LicenseResponse(BaseModel):
    id: str
    device_id: str
    source: str
    product_id: str
    status: str
    purchased_at: Optional[datetime] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_valid: bool = False


# ============================================================
# MULEH — Trial Models (3-day trial period)
# ============================================================

TRIAL_DURATION_DAYS = 3


# Header name the mobile app sends to identify the device
DEVICE_ID_HEADER = "X-Device-ID"


class UserTrial(BaseModel):
    """Tracks the 3-day trial period per device.

    Stored in `user_trials` collection. One document per device.
    The trial starts on first app launch and expires after 3 calendar days.
    After expiry the user must purchase a license to continue using
    navigation features.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str  # unique device identifier from the mobile app
    status: Literal["active", "expired", "converted"] = "active"
    trial_started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    trial_ends_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc).replace(hour=23, minute=59, second=59) + timedelta(days=TRIAL_DURATION_DAYS)
    )
    converted_at: Optional[datetime] = None  # when the user purchased a license
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserTrialCreate(BaseModel):
    """Input to manually create a trial record (admin/internal use).
    Normally trials are created automatically on first app launch."""
    device_id: str
    trial_started_at: Optional[datetime] = None


class UserTrialResponse(BaseModel):
    """Public response for trial status checks (no internal ids exposed)."""
    device_id: str
    status: str
    installed_at: Optional[datetime] = None  # alias for trial_started_at (install date)
    trial_started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    days_remaining: int = 0
    hours_remaining: float = 0  # precise remaining hours
    is_active: bool = False
    # Reminder fields
    should_remind: bool = False  # True if within reminder window
    reminder_message: Optional[str] = None  # Human-readable reminder text


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
# MULEH — Trial Helpers (used by guard + API)
# ============================================================

# Reminder thresholds (hours before expiry)
REMINDER_WINDOW_HOURS = 24  # start reminding 24h before expiry
URGENT_REMINDER_HOURS = 6   # urgent reminder 6h before expiry


class AccessLevel(BaseModel):
    """Centralized access level determination result.

    Combines trial and license checks into a single, consistent
    access decision used by guards, APIs, and the mobile app.
    """
    level: Literal["trial_active", "trial_expired", "licensed", "none"]
    has_trial: bool = False
    trial_status: Optional[str] = None
    days_remaining: int = 0
    has_license: bool = False
    license_source: Optional[str] = None
    access_allowed: bool = False
    should_show_paywall: bool = False
    should_remind: bool = False
    reminder_message: Optional[str] = None


async def _determine_access_level(device_id: str) -> AccessLevel:
    """Determine the access level for a device by checking both trial and license.

    This is the single source of truth for access decisions.
    Used by: require_active_trial guard, /access-status endpoint, login response.
    """
    now = datetime.now(timezone.utc)
    has_trial = False
    trial_status = None
    days_remaining = 0
    has_license = False
    license_source = None
    should_remind = False
    reminder_message = None

    # 1. Check license
    license_doc = await db.licenses.find_one(
        {"device_id": device_id, "status": "active"},
        sort=[("created_at", -1)],
    )
    if license_doc:
        valid_until = license_doc.get("valid_until")
        if valid_until is None or now <= valid_until:
            has_license = True
            license_source = license_doc.get("source", "google_play")

    # 2. Check trial
    trial_doc = await db.user_trials.find_one({"device_id": device_id})
    if trial_doc:
        has_trial = True
        trial_resp = _compute_trial_status(trial_doc)
        trial_status = trial_resp.status
        days_remaining = trial_resp.days_remaining
        should_remind = trial_resp.should_remind
        reminder_message = trial_resp.reminder_message

    # 3. Determine level
    if has_license:
        level = "licensed"
        access_allowed = True
    elif has_trial and trial_status == "active":
        level = "trial_active"
        access_allowed = True
    elif has_trial:
        level = "trial_expired"
        access_allowed = False
    else:
        level = "none"
        access_allowed = False

    return AccessLevel(
        level=level,
        has_trial=has_trial,
        trial_status=trial_status,
        days_remaining=days_remaining,
        has_license=has_license,
        license_source=license_source,
        access_allowed=access_allowed,
        should_show_paywall=not access_allowed,
        should_remind=should_remind,
        reminder_message=reminder_message,
    )


def _compute_trial_status(trial_doc: dict) -> UserTrialResponse:
    """Derive live trial status from a user_trials document.

    Checks trial_ends_at against now to determine if an 'active' trial
    has actually expired. Returns a UserTrialResponse with days_remaining,
    is_active, and reminder flags computed dynamically.
    """
    now = datetime.now(timezone.utc)
    status = trial_doc["status"]
    ends_at = trial_doc["trial_ends_at"]

    # Auto-expire if past end time and still marked active
    if status == "active" and now > ends_at:
        status = "expired"

    # Compute days remaining (ceil so partial day counts as 1)
    if status == "active":
        delta = ends_at - now
        days_remaining = max(0, delta.days + (1 if delta.seconds > 0 else 0))
    elif status == "converted":
        days_remaining = 0
    else:  # expired
        days_remaining = 0

    # Compute reminder flags
    should_remind = False
    reminder_message = None
    if status == "active" and ends_at:
        hours_left = (ends_at - now).total_seconds() / 3600
        if hours_left <= URGENT_REMINDER_HOURS:
            should_remind = True
            h = int(hours_left)
            reminder_message = f"Masa trial Anda tersisa {h} jam lagi. Beli lisensi untuk terus menggunakan MULEH."
        elif hours_left <= REMINDER_WINDOW_HOURS:
            should_remind = True
            d = int(days_remaining)
            reminder_message = f"Masa trial Anda tersisa {d} hari lagi. Beli lisensi untuk terus menggunakan MULEH."

    return UserTrialResponse(
        device_id=trial_doc["device_id"],
        status=status,
        installed_at=trial_doc.get("trial_started_at"),
        trial_started_at=trial_doc.get("trial_started_at"),
        trial_ends_at=ends_at,
        days_remaining=days_remaining,
        hours_remaining=round((ends_at - now).total_seconds() / 3600, 1) if status == "active" else 0.0,
        is_active=(status == "active"),
        should_remind=should_remind,
        reminder_message=reminder_message,
    )


# ============================================================
# MULEH — Trial Guard Dependency
# ============================================================

async def get_device_id(device_id: Optional[str] = Header(None, alias=DEVICE_ID_HEADER)) -> str:
    """Extract device_id from X-Device-ID header."""
    if not device_id:
        raise HTTPException(status_code=401, detail="Missing X-Device-ID header")
    return device_id


async def require_active_trial(device_id: str = Depends(get_device_id)) -> str:
    """FastAPI dependency that blocks requests if the device has no valid access.

    Uses the centralized `_determine_access_level` to check both
    license and trial status in a single, consistent manner.
    """
    access = await _determine_access_level(device_id)
    if not access.access_allowed:
        if access.level == "none":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "trial_required",
                    "message": "No trial found. Call /api/trial/ensure first.",
                    "device_id": device_id,
                },
            )
        else:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "access_denied",
                    "message": "Trial expired and no valid license. Please purchase to continue.",
                    "device_id": device_id,
                    "access_level": access.level,
                },
            )
    return device_id


# ============================================================
# MULEH — Navigation Session & Track Point APIs
# ============================================================

@api_router.post("/sessions", response_model=NavigationSession)
async def create_session(input: NavigationSessionCreate, _trial: str = Depends(require_active_trial)):
    """Start a new navigation recording session (user taps START RECORDING).

    Requires active trial or license (X-Device-ID header).
    """
    session = NavigationSession(**input.dict())
    await db.navigation_sessions.insert_one(session.dict())
    return session


@api_router.get("/sessions", response_model=List[NavigationSession])
async def list_sessions(limit: int = 50, offset: int = 0):
    """List all sessions, newest first."""
    docs = (
        await db.navigation_sessions.find()
        .sort("started_at", -1)
        .skip(offset)
        .to_list(limit)
    )
    return [NavigationSession(**d) for d in docs]


@api_router.get("/sessions/{session_id}", response_model=NavigationSession)
async def get_session(session_id: str):
    """Get a single session by ID."""
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return NavigationSession(**session)


@api_router.post("/sessions/{session_id}/complete", response_model=NavigationSession)
async def complete_session(session_id: str):
    """Mark a recording session as completed and set ended_at."""
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")
    now = datetime.now(timezone.utc)
    await db.navigation_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "completed", "ended_at": now}},
    )
    updated = await db.navigation_sessions.find_one({"id": session_id})
    return NavigationSession(**updated)


@api_router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all its track points and sensor readings."""
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.track_points.delete_many({"session_id": session_id})
    await db.sensor_readings.delete_many({"session_id": session_id})
    await db.navigation_sessions.delete_one({"id": session_id})
    return {"deleted": True, "id": session_id}


class SaveSessionInput(BaseModel):
    name: Optional[str] = None


class SessionSummary(BaseModel):
    """Lightweight session summary for the history page.

    Includes computed statistics from track points (steps estimate,
    turns, elevation gain) so the frontend can display rich info without
    additional computation.
    """
    id: str
    name: Optional[str]
    status: str
    tracking_mode: str
    point_count: int
    reading_count: int
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration_sec: Optional[int] = None
    has_route: bool = False
    # Computed from track points
    estimated_steps: int = 0
    estimated_turns: int = 0
    elevation_gain_m: float = 0.0
    floor_changes: int = 0


@api_router.post("/sessions/{session_id}/save", response_model=NavigationSession)
async def save_session(session_id: str, input: SaveSessionInput):
    """Complete a session, optionally set its name, and compute route stats.

    Combines marking the session as completed, setting a display name,
    and computing estimated steps, turns, and elevation gain from track points.
    """
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")
    now = datetime.now(timezone.utc)
    update = {"status": "completed", "ended_at": now}
    if input.name is not None:
        update["name"] = input.name.strip() or None

    # Compute route statistics from track points
    points = await db.track_points.find(
        {"session_id": session_id},
    ).sort("sequence", 1).to_list(10000)

    if points:
        # Steps: count points with relative movement (IMU) or just count all (GPS)
        steps = sum(1 for p in points if p.get("relative_x") is not None or p.get("relative_y") is not None)
        if steps == 0:
            steps = len(points)
        update["point_count"] = steps

        # Turns: count heading changes > 30° between consecutive points
        turns = 0
        prev_heading = points[0].get("relative_heading") or points[0].get("heading")
        for p in points[1:]:
            h = p.get("relative_heading") or p.get("heading")
            if h is not None and prev_heading is not None:
                diff = abs(h - prev_heading)
                if diff > 180:
                    diff = 360 - diff
                if diff >= 30:
                    turns += 1
            prev_heading = h
        update["estimated_turns"] = turns

        # Elevation gain: max - min of z values
        z_values = [p["relative_z"] for p in points if p.get("relative_z") is not None]
        if z_values:
            update["elevation_gain_m"] = round(max(z_values) - min(z_values), 2)

        # Floor changes: count z-level transitions (change > 2m)
        z_sorted = sorted(z_values) if z_values else []
        floor_transitions = 0
        for i in range(1, len(z_sorted)):
            if z_sorted[i] - z_sorted[i - 1] > 2.0:
                floor_transitions += 1
        update["floor_changes"] = floor_transitions

    await db.navigation_sessions.update_one({"id": session_id}, {"$set": update})
    updated = await db.navigation_sessions.find_one({"id": session_id})
    return NavigationSession(**updated)


@api_router.get("/sessions/summary", response_model=List[SessionSummary])
async def list_session_summaries(status: Optional[str] = None, limit: int = 50, offset: int = 0):
    """List sessions with computed duration and route availability.

    Optimized for the mobile history page — returns lightweight objects
    without full start_point data. Filter by ``?status=completed`` to
    get only saved route history.
    """
    query = {}
    if status is not None:
        query["status"] = status
    docs = (
        await db.navigation_sessions.find(query)
        .sort("started_at", -1)
        .skip(offset)
        .to_list(limit)
    )
    summaries = []
    for d in docs:
        dur = None
        if d.get("started_at") and d.get("ended_at"):
            dur = int((d["ended_at"] - d["started_at"]).total_seconds())
        summaries.append(SessionSummary(
            id=d["id"],
            name=d.get("name"),
            status=d["status"],
            tracking_mode=d.get("tracking_mode", "imu"),
            point_count=d.get("point_count", 0),
            reading_count=d.get("reading_count", 0),
            started_at=d.get("started_at"),
            ended_at=d.get("ended_at"),
            duration_sec=dur,
            has_route=d.get("point_count", 0) > 0,
            estimated_steps=d.get("point_count", 0),
            estimated_turns=d.get("estimated_turns", 0),
            elevation_gain_m=d.get("elevation_gain_m", 0),
            floor_changes=d.get("floor_changes", 0),
        ))
    return summaries


@api_router.post("/sessions/{session_id}/points", response_model=TrackPoint)
async def add_track_point(session_id: str, input: TrackPointCreate, _trial: str = Depends(require_active_trial)):
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
async def add_track_points_batch(session_id: str, input: TrackPointBatchCreate, _trial: str = Depends(require_active_trial)):
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


# ============================================================
# MULEH — Sensor Reading APIs (background recording service)
# ============================================================

@api_router.post("/sessions/{session_id}/sensor-readings/batch", response_model=List[SensorReading])
async def add_sensor_readings_batch(session_id: str, input: SensorReadingBatchCreate, _trial: str = Depends(require_active_trial)):
    """Receive a batch of raw IMU sensor readings from the device.

    The mobile app records sensor data in the background (accelerometer,
    gyroscope, magnetometer, barometer) and flushes it in batches to this
    endpoint. Each reading is assigned a monotonically increasing sequence
    number based on the session's current ``reading_count``.
    """
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "recording":
        raise HTTPException(status_code=400, detail="Session is not recording")
    if not input.readings:
        return []

    start_seq = session.get("reading_count", 0)
    readings = []
    for offset, r in enumerate(input.readings):
        data = r.dict()
        if data.get("recorded_at") is None:
            data["recorded_at"] = datetime.now(timezone.utc)
        readings.append(SensorReading(session_id=session_id, sequence=start_seq + offset, **data))
    await db.sensor_readings.insert_many([rd.dict() for rd in readings])
    await db.navigation_sessions.update_one(
        {"id": session_id}, {"$inc": {"reading_count": len(readings)}}
    )
    return readings


@api_router.get("/sessions/{session_id}/sensor-readings", response_model=List[SensorReading])
async def get_sensor_readings(session_id: str, limit: int = 5000):
    """Retrieve raw sensor readings for a session, ordered by sequence.

    Used by the route-building algorithm or debugging tools.
    Defaults to 5 000 readings (≈ ~2.5 min at 30 Hz).
    """
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    docs = (
        await db.sensor_readings.find({"session_id": session_id})
        .sort("sequence", 1)
        .to_list(limit)
    )
    return [SensorReading(**d) for d in docs]


# ============================================================
# MULEH — Route Builder API (sensor data → track points)
# ============================================================

class BuiltRoutePoint(BaseModel):
    """A track point produced by the dead-reckoning algorithm."""
    sequence: int
    relative_x: float
    relative_y: float
    relative_z: float
    relative_heading: float
    is_step: bool
    floor_change: Optional[str] = None


class BuiltRouteResponse(BaseModel):
    """Result of processing sensor readings into a route."""
    session_id: str
    input_readings: int
    output_points: int
    points: List[BuiltRoutePoint]


@api_router.post("/sessions/{session_id}/build-route", response_model=BuiltRouteResponse)
async def build_route_from_sensors(session_id: str, _trial: str = Depends(require_active_trial)):
    """Process raw sensor readings into relative-position track points.

    Runs the dead-reckoning algorithm (step detection + heading integration
    + floor detection) on all sensor readings for the session, then stores
    the resulting track points and returns them.

    Idempotent: calling multiple times replaces previous built points
    (deletes old auto-generated points, keeps manually added ones).
    """
    session = await db.navigation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch all sensor readings
    docs = (
        await db.sensor_readings.find({"session_id": session_id})
        .sort("sequence", 1)
        .to_list(50000)
    )

    if not docs:
        return BuiltRouteResponse(
            session_id=session_id,
            input_readings=0,
            output_points=0,
            points=[],
        )

    # Convert to RawReading objects
    raw: List[RawReading] = []
    for d in docs:
        acc = d.get("accelerometer", {})
        gyro = d.get("gyroscope", {})
        mag = d.get("magnetometer")
        raw.append(RawReading(
            sequence=d["sequence"],
            acc_x=acc.get("x", 0),
            acc_y=acc.get("y", 0),
            acc_z=acc.get("z", 0),
            gyro_x=gyro.get("x", 0),
            gyro_y=gyro.get("y", 0),
            gyro_z=gyro.get("z", 0),
            mag_x=mag.get("x") if mag else None,
            mag_y=mag.get("y") if mag else None,
            mag_z=mag.get("z") if mag else None,
            pressure=d.get("pressure"),
            recorded_at=str(d.get("recorded_at", "")),
        ))

    # Run algorithm
    route_points = build_route(raw)

    # Delete previous auto-built points (marked by non-null relative_x/y on IMU sessions)
    # and insert new ones
    if route_points:
        # Determine starting sequence (after any existing manually-added points)
        existing = await db.track_points.find(
            {"session_id": session_id}
        ).sort("sequence", -1).limit(1).to_list(1)
        start_seq = (existing[0]["sequence"] + 1) if existing else 0

        new_points = []
        for rp in route_points:
            pt_data = {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "sequence": start_seq + rp.sequence,
                "relative_x": rp.relative_x,
                "relative_y": rp.relative_y,
                "relative_z": rp.relative_z,
                "relative_heading": rp.relative_heading,
                "latitude": None,
                "longitude": None,
                "altitude": None,
                "accuracy": None,
                "heading": None,
                "recorded_at": datetime.now(timezone.utc),
            }
            new_points.append(pt_data)

        await db.track_points.insert_many(new_points)
        await db.navigation_sessions.update_one(
            {"id": session_id},
            {"$inc": {"point_count": len(new_points)}},
        )

    return BuiltRouteResponse(
        session_id=session_id,
        input_readings=len(raw),
        output_points=len(route_points),
        points=[
            BuiltRoutePoint(
                sequence=rp.sequence,
                relative_x=rp.relative_x,
                relative_y=rp.relative_y,
                relative_z=rp.relative_z,
                relative_heading=rp.relative_heading,
                is_step=rp.is_step,
                floor_change=rp.floor_change,
            )
            for rp in route_points
        ],
    )

# ============================================================
# MULEH — Trial Status API
# ============================================================


class TrialStatusInput(BaseModel):
    device_id: str


class EnsureTrialInput(BaseModel):
    device_id: str
    trial_started_at: Optional[datetime] = None  # allow client to pass its local start time


@api_router.post("/trial/ensure", response_model=UserTrialResponse)
async def ensure_trial(input: EnsureTrialInput):
    """Ensure a trial exists for this device (auto-start on first use).

    If no trial record exists for the device_id, creates one with
    status='active' and trial_ends_at = started + 3 days (23:59:59 UTC).
    If a trial already exists, returns its current status.

    This is the endpoint the mobile app calls on every launch to
    guarantee the trial is initialized.
    """
    existing = await db.user_trials.find_one({"device_id": input.device_id})
    if existing:
        return _compute_trial_status(existing)

    # Create new trial
    started = input.trial_started_at if input.trial_started_at else datetime.now(timezone.utc)
    ends = started.replace(hour=23, minute=59, second=59, microsecond=0) + timedelta(days=TRIAL_DURATION_DAYS)
    now = datetime.now(timezone.utc)

    trial = UserTrial(
        device_id=input.device_id,
        status="active",
        trial_started_at=started,
        trial_ends_at=ends,
        created_at=now,
        updated_at=now,
    )
    await db.user_trials.insert_one(trial.dict())
    logger.info(f"Trial created for device={input.device_id}, ends={ends}")

    return _compute_trial_status(trial.dict())


@api_router.get("/trial/status", response_model=UserTrialResponse)
async def get_trial_status(device_id: str):
    """Check trial status and remaining days for a device.

    Returns the current trial state (active/expired/converted),
    days remaining, and boolean is_active flag. If no trial record
    exists for the device, returns a response with status='none'
    and is_active=False.

    Query parameter: ?device_id=xxx
    """
    doc = await db.user_trials.find_one({"device_id": device_id})
    if not doc:
        return UserTrialResponse(
            device_id=device_id,
            status="none",
            days_remaining=0,
            is_active=False,
        )
    return _compute_trial_status(doc)


@api_router.post("/trial/status", response_model=UserTrialResponse)
async def get_trial_status_post(input: TrialStatusInput):
    """Check trial status via POST (alternative to GET for devices
    that prefer sending device_id in the body)."""
    doc = await db.user_trials.find_one({"device_id": input.device_id})
    if not doc:
        return UserTrialResponse(
            device_id=input.device_id,
            status="none",
            days_remaining=0,
            is_active=False,
        )
    return _compute_trial_status(doc)


# ============================================================
# MULEH — Google Play Purchase Verification
# ============================================================

# Google Play Developer API config (set in .env)
GOOGLE_PACKAGE_NAME = os.environ.get("GOOGLE_PACKAGE_NAME", "com.muleh.app")
GOOGLE_PRODUCT_ID = os.environ.get("GOOGLE_PRODUCT_ID", "muleh_full_license")
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")  # path to JSON key


class VerifyPurchaseInput(BaseModel):
    device_id: str
    purchase_token: str  # token from Google Play Billing Library
    product_id: Optional[str] = None  # override default product_id
    package_name: Optional[str] = None  # override default package_name


class VerifyPurchaseResponse(BaseModel):
    success: bool
    device_id: str
    trial_status: str
    message: str
    license_id: Optional[str] = None  # ID of created license record


class ProductInfo(BaseModel):
    """Google Play product/SKU info for the mobile app to initiate purchase."""
    product_id: str
    product_type: str  # "inapp" for one-time, "subs" for subscription
    display_name: str
    description: str
    price_micros: Optional[int] = None  # price in micro-units
    currency: Optional[str] = None


class CombinedAccessStatus(BaseModel):
    """Combined trial + license status for the mobile app.

    The app calls this once on launch to determine:
    - Whether to show the main navigation UI (access_allowed=True)
    - Whether to show a paywall or trial banner
    - What information to display about the user's access level
    """
    device_id: str
    access_allowed: bool  # True if trial active OR has valid license
    access_source: str  # "trial", "license", "none"
    trial: Optional[UserTrialResponse] = None
    license: Optional[LicenseResponse] = None
    show_paywall: bool = False
    show_reminder: bool = False
    reminder_message: Optional[str] = None


@api_router.get("/access-status/{device_id}", response_model=CombinedAccessStatus)
async def get_access_status(device_id: str):
    """Get combined trial + license access status for a device.

    This is the single endpoint the mobile app should call on every launch
    to determine the user's access level. Uses the centralized
    `_determine_access_level` for consistent access decisions.
    """
    access = await _determine_access_level(device_id)

    # Get full trial response for details
    trial_doc = await db.user_trials.find_one({"device_id": device_id})
    trial_resp = _compute_trial_status(trial_doc) if trial_doc else None

    # Get license response
    license_resp = None
    if access.has_license:
        license_doc = await db.licenses.find_one(
            {"device_id": device_id, "status": "active"},
            sort=[("created_at", -1)],
        )
        if license_doc:
            now = datetime.now(timezone.utc)
            is_valid = True
            if license_doc.get("valid_until") and now > license_doc["valid_until"]:
                is_valid = False
            license_resp = LicenseResponse(
                id=license_doc["id"],
                device_id=license_doc["device_id"],
                source=license_doc["source"],
                product_id=license_doc["product_id"],
                status=license_doc["status"],
                purchased_at=license_doc.get("purchased_at"),
                valid_from=license_doc.get("valid_from"),
                valid_until=license_doc.get("valid_until"),
                is_valid=is_valid,
            )

    return CombinedAccessStatus(
        device_id=device_id,
        access_allowed=access.access_allowed,
        access_source=access.level,
        trial=trial_resp,
        license=license_resp,
        show_paywall=access.should_show_paywall,
        show_reminder=access.should_remind,
        reminder_message=access.reminder_message,
    )


@api_router.get("/billing/product-info", response_model=ProductInfo)
async def get_product_info():
    """Return product/SKU details for Google Play Billing.

    The mobile app calls this to know which product_id to use when
    launching the Google Play purchase flow.
    """
    return ProductInfo(
        product_id=GOOGLE_PRODUCT_ID,
        product_type="inapp",  # one-time purchase
        display_name="MULEH Full License",
        description="Lifetime access to all MULEH AR navigation features.",
        price_micros=None,  # actual price comes from Google Play
        currency=None,
    )


@api_router.get("/license/{device_id}", response_model=Optional[LicenseResponse])
async def get_license(device_id: str):
    """Get the latest active license for a device.

    Returns the most recent license record. Used by the app to
    confirm license status without relying solely on trial status.
    """
    doc = await db.licenses.find_one(
        {"device_id": device_id, "status": "active"},
        sort=[("created_at", -1)],
    )
    if not doc:
        return None

    now = datetime.now(timezone.utc)
    is_valid = True
    if doc.get("valid_until") and now > doc["valid_until"]:
        is_valid = False

    return LicenseResponse(
        id=doc["id"],
        device_id=doc["device_id"],
        source=doc["source"],
        product_id=doc["product_id"],
        status=doc["status"],
        purchased_at=doc.get("purchased_at"),
        valid_from=doc.get("valid_from"),
        valid_until=doc.get("valid_until"),
        is_valid=is_valid,
    )


async def _verify_google_play_purchase(purchase_token: str, package_name: str, product_id: str) -> dict:
    """Verify a purchase token with Google Play Developer API.

    Uses the Purchases.products.get endpoint to validate the token.
    Returns a dict with purchase details on success, raises on failure.

    Note: In production this requires a valid Google Play service account.
    For now, the structure is in place and can be activated by setting
    GOOGLE_SERVICE_ACCOUNT_JSON in .env.
    """
    import json as _json
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession

    if not GOOGLE_SERVICE_ACCOUNT_JSON:
        # No service account configured — raise a clear error
        raise HTTPException(
            status_code=503,
            detail={
                "error": "google_play_not_configured",
                "message": "Google Play service account not configured on server.",
            },
        )

    scopes = ["https://www.googleapis.com/auth/androidpublisher"]
    creds = service_account.Credentials.from_service_account_file(
        GOOGLE_SERVICE_ACCOUNT_JSON, scopes=scopes
    )
    authed_session = AuthorizedSession(creds)

    url = (
        f"https://androidpublisher.googleapis.com/androidpublisher/v3/"
        f"applications/{package_name}/purchases/products/{product_id}"
        f"/tokens/{purchase_token}"
    )
    resp = authed_session.get(url)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "purchase_verification_failed",
                "message": f"Google Play returned {resp.status_code}: {resp.text}",
            },
        )

    return resp.json()


@api_router.post("/trial/verify-purchase", response_model=VerifyPurchaseResponse)
async def verify_purchase(input: VerifyPurchaseInput):
    """Verify a Google Play purchase and activate the license.

    The mobile app sends the purchase_token obtained from Google Play
    Billing Library after a successful purchase. This endpoint:
    1. Verifies the token with Google Play Developer API
    2. Updates the user_trials record to status='converted'
    3. Returns the new trial/license status

    If GOOGLE_SERVICE_ACCOUNT_JSON is not configured, returns 503.
    """
    pkg = input.package_name or GOOGLE_PACKAGE_NAME
    product = input.product_id or GOOGLE_PRODUCT_ID

    # Verify with Google Play
    purchase = await _verify_google_play_purchase(input.purchase_token, pkg, product)

    # Check purchase state (0 = purchased)
    purchase_state = purchase.get("purchaseState", -1)
    if purchase_state != 0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "purchase_not_valid",
                "message": f"Purchase is not valid (state={purchase_state}).",
            },
        )

    # Check for duplicate purchase token
    if input.purchase_token:
        existing = await db.licenses.find_one({"purchase_token": input.purchase_token})
        if existing:
            # Already processed — return success
            doc = await db.user_trials.find_one({"device_id": input.device_id})
            new_status = _compute_trial_status(doc) if doc else None
            return VerifyPurchaseResponse(
                success=True,
                device_id=input.device_id,
                trial_status=new_status.status if new_status else "converted",
                message="Purchase already verified.",
            )

    # Update trial record to converted
    now = datetime.now(timezone.utc)
    result = await db.user_trials.update_one(
        {"device_id": input.device_id},
        {"$set": {
            "status": "converted",
            "converted_at": now,
            "updated_at": now,
        }},
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail={"error": "trial_not_found", "message": "No trial record for this device."},
        )

    # Create license record
    license_record = License(
        device_id=input.device_id,
        source="google_play",
        product_id=product,
        purchase_token=input.purchase_token,
        order_id=purchase.get("orderId"),
        status="active",
        purchased_at=now,
        valid_from=now,
        valid_until=None,  # lifetime license
        created_at=now,
    )
    await db.licenses.insert_one(license_record.dict())

    doc = await db.user_trials.find_one({"device_id": input.device_id})
    new_status = _compute_trial_status(doc)

    logger.info(f"Purchase verified for device={input.device_id}, license_id={license_record.id}, converted_at={now}")

    return VerifyPurchaseResponse(
        success=True,
        device_id=input.device_id,
        trial_status=new_status.status,
        license_id=license_record.id,
        message="Purchase verified. License activated.",
    )


# ============================================================
# MULEH — Account Registration & Login APIs
# ============================================================


@api_router.post("/auth/register", response_model=AccountResponse, status_code=201)
async def register_account(input: AccountCreate):
    """Register a new account with email + hashed password.

    - Hashes password with bcrypt
    - Auto-starts 3-day trial for the device (if device_id provided)
    - Links device_id to the account
    - Returns public account data (no password_hash)
    """
    email = input.email.strip().lower()

    # Check email uniqueness
    existing = await db.accounts.find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"error": "email_exists", "message": "Email already registered."},
        )

    # Hash password
    password_bytes = input.password.encode("utf-8")
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password_bytes, salt).decode("utf-8")

    now = datetime.now(timezone.utc)
    device_ids = [input.device_id] if input.device_id else []

    account = Account(
        email=email,
        password_hash=password_hash,
        display_name=input.display_name.strip() if input.display_name else None,
        device_ids=device_ids,
        created_at=now,
        updated_at=now,
    )
    await db.accounts.insert_one(account.dict())

    # Auto-start trial if device_id provided
    if input.device_id:
        existing_trial = await db.user_trials.find_one({"device_id": input.device_id})
        if not existing_trial:
            started = now
            ends = started.replace(hour=23, minute=59, second=59, microsecond=0) + timedelta(days=TRIAL_DURATION_DAYS)
            trial = UserTrial(
                device_id=input.device_id,
                status="active",
                trial_started_at=started,
                trial_ends_at=ends,
                created_at=now,
                updated_at=now,
            )
            await db.user_trials.insert_one(trial.dict())

    logger.info(f"Account registered: email={email}, device_ids={device_ids}")

    return AccountResponse(
        id=account.id,
        email=account.email,
        display_name=account.display_name,
        status=account.status,
        device_ids=account.device_ids,
        created_at=account.created_at,
    )


class LoginResponse(BaseModel):
    """Response after successful login."""
    account: AccountResponse
    access_level: Optional[AccessLevel] = None
    token: Optional[str] = None  # JWT token for subsequent requests


JWT_SECRET = os.environ.get("JWT_SECRET", "muleh-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))  # 7 days default


def _create_jwt_token(account_id: str, email: str) -> str:
    """Create a JWT token for the authenticated user."""
    import jwt
    payload = {
        "sub": account_id,
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@api_router.post("/auth/login", response_model=LoginResponse)
async def login_account(input: AccountLoginInput):
    """Login with email + password.

    - Validates credentials against bcrypt hash
    - Links device_id to account (if provided and not already linked)
    - Auto-starts trial for new device
    - Updates last_login_at
    - Returns account data + JWT token
    """
    email = input.email.strip().lower()
    doc = await db.accounts.find_one({"email": email})

    if not doc:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_credentials", "message": "Email or password is incorrect."},
        )

    # Verify password
    password_bytes = input.password.encode("utf-8")
    stored_hash = doc["password_hash"].encode("utf-8")
    if not bcrypt.checkpw(password_bytes, stored_hash):
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_credentials", "message": "Email or password is incorrect."},
        )

    # Check account status
    if doc["status"] == "suspended":
        raise HTTPException(
            status_code=403,
            detail={"error": "account_suspended", "message": "Account is suspended."},
        )
    if doc["status"] == "deleted":
        raise HTTPException(
            status_code=401,
            detail={"error": "account_deleted", "message": "Account has been deleted."},
        )

    now = datetime.now(timezone.utc)

    # Link device_id if provided and not already linked
    if input.device_id and input.device_id not in doc.get("device_ids", []):
        await db.accounts.update_one(
            {"id": doc["id"]},
            {"$push": {"device_ids": input.device_id}, "$set": {"updated_at": now}},
        )
        doc["device_ids"] = doc.get("device_ids", []) + [input.device_id]

        # Auto-start trial for new device
        existing_trial = await db.user_trials.find_one({"device_id": input.device_id})
        if not existing_trial:
            started = now
            ends = started.replace(hour=23, minute=59, second=59, microsecond=0) + timedelta(days=TRIAL_DURATION_DAYS)
            trial = UserTrial(
                device_id=input.device_id,
                status="active",
                trial_started_at=started,
                trial_ends_at=ends,
                created_at=now,
                updated_at=now,
            )
            await db.user_trials.insert_one(trial.dict())

    # Update last login
    await db.accounts.update_one(
        {"id": doc["id"]},
        {"$set": {"last_login_at": now, "updated_at": now}},
    )

    # Create JWT token
    token = _create_jwt_token(doc["id"], doc["email"])

    logger.info(f"Account login: email={email}, device={input.device_id}")

    account_resp = AccountResponse(
        id=doc["id"],
        email=doc["email"],
        display_name=doc.get("display_name"),
        status=doc["status"],
        device_ids=doc.get("device_ids", []),
        created_at=doc.get("created_at"),
        last_login_at=now,
    )

    # Determine access level for the device
    access_lvl = None
    if input.device_id:
        access_lvl = await _determine_access_level(input.device_id)

    return LoginResponse(account=account_resp, access_level=access_lvl, token=token)


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
