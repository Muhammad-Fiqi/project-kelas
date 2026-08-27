# MULEH — Database Schema (MongoDB)

Collections, field definitions, indexes, and relationships.

---

## Collections

| Collection | Purpose | Primary Key |
|---|---|---|
| `navigation_sessions` | One document per recorded walk/route | `id` (UUID string) |
| `track_points` | Ordered breadcrumb points per session | `id` (UUID string) |
| `sensor_readings` | Raw IMU sensor samples per session | `id` (UUID string) |
| `user_trials` | Per-device 3-day trial period tracking | `id` (UUID string) |
| `licenses` | Purchase/license records per device | `id` (UUID string) |
| `accounts` | User accounts (email, password, status) | `id` (UUID string) |
| `status_checks` | Health check pings (dev/debug) | `id` (UUID string) |

---

## `navigation_sessions`

### Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | UUID | Unique session ID |
| `name` | string? | no | null | Display label (e.g. "Parkiran Mall") |
| `status` | "recording" \| "completed" | yes | "recording" | Session lifecycle state |
| `tracking_mode` | "gps" \| "imu" | yes | "imu" | Sensor mode used |
| `start_point` | GeoPoint | yes | — | Origin/finish location |
| `point_count` | int | yes | 0 | Denormalized count of track points |
| `reading_count` | int | yes | 0 | Denormalized count of sensor readings |
| `started_at` | datetime | yes | utcnow | When recording started |
| `ended_at` | datetime? | no | null | When recording ended |

### GeoPoint (embedded)

| Field | Type | Required | Description |
|---|---|---|---|
| `latitude` | float | yes | WGS84 latitude |
| `longitude` | float | yes | WGS84 longitude |
| `altitude` | float? | no | meters |
| `accuracy` | float? | no | GPS accuracy radius (meters) |

### Indexes

| Fields | Purpose |
|---|---|
| `{started_at: -1}` | Newest sessions first |
| `{status: 1}` | Filter by status |
| `{status: 1, started_at: -1}` | Completed sessions, newest first |
| `{name: 1}` | Name search for history |
| `{tracking_mode: 1}` | Filter by tracking mode |

---

## `track_points`

### Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | UUID | Unique point ID |
| `session_id` | string | yes | — | → navigation_sessions.id |
| `sequence` | int | yes | 0 | 0-based order within session |
| `latitude` | float? | no | null | GPS mode: WGS84 latitude |
| `longitude` | float? | no | null | GPS mode: WGS84 longitude |
| `altitude` | float? | no | null | meters |
| `accuracy` | float? | no | null | GPS accuracy (meters) |
| `heading` | float? | no | null | GPS heading 0-360° |
| `relative_x` | float? | no | null | IMU mode: east displacement (m) |
| `relative_y` | float? | no | null | IMU mode: north displacement (m) |
| `relative_z` | float? | no | null | IMU mode: vertical displacement (m) |
| `relative_heading` | float? | no | null | IMU mode: heading relative to start (°) |
| `recorded_at` | datetime | yes | utcnow | When the sample was captured |

### Indexes

| Fields | Purpose |
|---|---|
| `{session_id: 1, sequence: 1}` | Unique constraint + ordered fetch |
| `{session_id: 1}` | Count queries |

---

## `sensor_readings`

### Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | UUID | Unique reading ID |
| `session_id` | string | yes | — | → navigation_sessions.id |
| `sequence` | int | yes | 0 | 0-based order within session |
| `accelerometer` | IMUSample | yes | — | m/s² (x, y, z) |
| `gyroscope` | IMUSample | yes | — | rad/s (x, y, z) |
| `magnetometer` | IMUSample? | no | null | μT (x, y, z) |
| `pressure` | float? | no | null | hPa (barometer) |
| `recorded_at` | datetime | yes | utcnow | When the sample was captured |

### IMUSample (embedded)

| Field | Type | Description |
|---|---|---|
| x | float | Axis value |
| y | float | Axis value |
| z | float | Axis value |

### Indexes

| Fields | Purpose |
|---|---|
| `{session_id: 1, sequence: 1}` | Ordered fetch for route building |
| `{session_id: 1}` | Count queries |

---

## `user_trials`

### Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | UUID | Unique trial record ID |
| `device_id` | string | yes | — | Unique device identifier (from mobile app) |
| `status` | "active" \| "expired" \| "converted" | yes | "active" | Trial lifecycle state |
| `trial_started_at` | datetime | yes | utcnow | When the trial period started |
| `trial_ends_at` | datetime | yes | started + 3 days | When the trial expires (end of day 3) |
| `converted_at` | datetime? | no | null | When the user purchased a license |
| `created_at` | datetime | yes | utcnow | Document creation timestamp |
| `updated_at` | datetime | yes | utcnow | Last modification timestamp |

### Status Transitions

```
active ──► expired      (trial_ends_at passed, no purchase)
active ──► converted    (user purchased before expiry)
expired ──► converted  (user purchased after expiry)
```

### Indexes

| Fields | Purpose |
|---|---|
| `{device_id: 1}` (unique) | One trial per device, fast lookup |
| `{status: 1}` | Filter trials by status |

### Trial Duration

- **TRIAL_DURATION_DAYS = 3** (defined in `server.py`)
- Trial ends at **23:59:59 UTC** on the 3rd day after `trial_started_at`
- Example: started Jan 1 14:00 → ends Jan 4 23:59:59 UTC

---

## `licenses`

### Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | UUID | Unique license ID |
| `device_id` | string | yes | — | → user_trials.device_id |
| `source` | "google_play" \| "manual" | yes | "google_play" | Purchase source |
| `product_id` | string | yes | — | Product SKU (e.g. "muleh_full_license") |
| `purchase_token` | string? | no | null | Google Play purchase token |
| `order_id` | string? | no | null | Google Play order ID |
| `status` | "active" \| "revoked" \| "expired" | yes | "active" | License state |
| `purchased_at` | datetime | yes | utcnow | When the purchase was made |
| `valid_from` | datetime | yes | utcnow | License start date |
| `valid_until` | datetime? | no | null | License end (null = lifetime) |
| `revoked_at` | datetime? | no | null | When revoked |
| `created_at` | datetime | yes | utcnow | Document creation timestamp |

### Indexes

| Fields | Purpose |
|---|---|
| `{device_id: 1, created_at: -1}` | Latest license per device |
| `{purchase_token: 1}` (sparse) | Dedup Google Play purchases |
| `{status: 1}` | Filter by status |

---

## `accounts`

### Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | UUID | Unique account ID |
| `email` | string | yes | — | Unique email (lowercase) |
| `password_hash` | string | yes | — | bcrypt hash of password |
| `display_name` | string? | no | null | User display name |
| `status` | "active" \| "suspended" \| "deleted" | yes | "active" | Account state |
| `device_ids` | string[] | yes | [] | Linked device IDs |
| `created_at` | datetime | yes | utcnow | Account creation timestamp |
| `updated_at` | datetime | yes | utcnow | Last modification timestamp |
| `last_login_at` | datetime? | no | null | Most recent login time |

### Indexes

| Fields | Purpose |
|---|---|
| `{email: 1}` (unique) | Unique email, fast login lookup |
| `{status: 1}` | Filter by status |

---

## Relationships

```
navigation_sessions 1──N track_points
navigation_sessions 1──N sensor_readings
user_trials          1──1 device  (one trial record per device)
user_trials          1──N licenses  (purchase history per device)
accounts             1──N user_trials  (account owns devices)
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/sessions | Create session |
| GET | /api/sessions | List sessions (full) |
| GET | /api/sessions/summary | List sessions (lightweight) |
| GET | /api/sessions/{id} | Get session detail |
| POST | /api/sessions/{id}/save | Complete + name session |
| POST | /api/sessions/{id}/complete | Mark completed |
| DELETE | /api/sessions/{id} | Delete session + data |
| POST | /api/sessions/{id}/points | Add track point |
| POST | /api/sessions/{id}/points/batch | Batch add track points |
| GET | /api/sessions/{id}/route | Get full route |
| POST | /api/sessions/{id}/sensor-readings/batch | Batch upload sensor data |
| GET | /api/sessions/{id}/sensor-readings | Retrieve sensor data |
| POST | /api/sessions/{id}/build-route | Build route from sensors |
| POST | /api/trial/ensure | Auto-start trial on first use (upsert) |
| GET | /api/trial/status?device_id=xxx | Check trial status (GET) |
| POST | /api/trial/status | Check trial status (POST body) |
| POST | /api/trial/verify-purchase | Verify Google Play purchase & convert trial |
| GET | /api/billing/product-info | Get product/SKU info for purchase flow |
| GET | /api/license/{device_id} | Get latest active license for device |
| GET | /api/access-status/{device_id} | Combined trial+license status for app launch |
| POST | /api/auth/register | Register account (email+password, auto-start trial) |
| POST | /api/auth/login | Login with email+password, returns JWT token |
