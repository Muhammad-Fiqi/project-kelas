"""MULEH — Route builder: convert raw IMU sensor readings into track points.

Implements a simplified pedestrian dead-reckoning (PDR) algorithm:
1. Step detection from accelerometer magnitude peaks.
2. Heading estimation by integrating gyroscope angular velocity.
3. Position estimation: step length × heading per detected step.
4. Floor change detection from barometric pressure deltas.

This runs server-side after sensor readings are uploaded, producing
relative-position track points suitable for the AR view.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class RawReading:
    """One sensor reading (mirrors SensorReading model)."""
    sequence: int
    acc_x: float
    acc_y: float
    acc_z: float
    gyro_x: float
    gyro_y: float
    gyro_z: float
    mag_x: Optional[float] = None
    mag_y: Optional[float] = None
    mag_z: Optional[float] = None
    pressure: Optional[float] = None
    recorded_at: Optional[str] = None  # ISO string


@dataclass
class RelativePoint:
    """A computed track point in relative coordinates."""
    sequence: int
    relative_x: float  # meters east
    relative_y: float  # meters north
    relative_z: float  # meters vertical
    relative_heading: float  # degrees from start heading
    is_step: bool  # whether a step was detected at this point
    floor_change: Optional[str] = None  # "up" / "down" / None


# ---- Algorithm parameters (tunable) ----

# Accelerometer-based step detection
ACC_MAG_THRESHOLD = 9.81 + 1.5  # m/s^2 — magnitude above this = potential step
ACC_MAG_MIN_INTERVAL = 0.3  # seconds — minimum time between steps
STEP_LENGTH_DEFAULT = 0.7  # meters — average step length

# Gyroscope integration
GYRO_SAMPLING_HZ = 30.0  # assumed sensor sample rate
GYRO_DRIFT_COMPENSATION = 0.98  # low-pass filter to reduce gyro drift

# Barometer floor detection
PRESSURE_FLOOR_THRESHOLD = 0.5  # hPa — pressure change to count as floor transition
PRESSURE_SMOOTHING = 0.2  # exponential smoothing factor


def _acc_magnitude(r: RawReading) -> float:
    """Compute accelerometer vector magnitude."""
    return math.sqrt(r.acc_x ** 2 + r.acc_y ** 2 + r.acc_z ** 2)


def _detect_steps(readings: List[RawReading]) -> List[int]:
    """Return indices of readings where a step is detected (peak above threshold)."""
    if not readings:
        return []

    step_indices = []
    last_step_time = -ACC_MAG_MIN_INTERVAL * 2  # ensure first step can be detected

    for i, r in enumerate(readings):
        mag = _acc_magnitude(r)
        dt = (i / GYRO_SAMPLING_HZ) - last_step_time

        # Simple peak detection: magnitude crosses above threshold
        # and enough time has passed since last step.
        if mag > ACC_MAG_THRESHOLD and dt >= ACC_MAG_MIN_INTERVAL:
            step_indices.append(i)
            last_step_time = i / GYRO_SAMPLING_HZ

    return step_indices


def _integrate_heading(readings: List[RawReading]) -> List[float]:
    """Integrate gyroscope Z-axis to get cumulative heading change (degrees).

    Returns a list of heading offsets (degrees) aligned with input indices.
    Applies a simple low-pass filter to reduce drift.
    """
    headings = [0.0]  # start at 0
    filtered_gz = 0.0

    for i in range(1, len(readings)):
        # Gyro Z-axis gives yaw rate (rad/s)
        gz = readings[i].gyro_z
        filtered_gz = GYRO_DRIFT_COMPENSATION * filtered_gz + (1 - GYRO_DRIFT_COMPENSATION) * gz

        dt = 1.0 / GYRO_SAMPLING_HZ
        delta_deg = math.degrees(filtered_gz * dt)
        headings.append(headings[-1] + delta_deg)

    return headings


def _detect_floor_changes(readings: List[RawReading]) -> dict:
    """Detect floor transitions from barometric pressure.

    Returns a dict mapping reading index -> "up" or "down".
    """
    floor_events: dict[int, str] = {}
    pressures = [r.pressure for r in readings if r.pressure is not None]

    if len(pressures) < 10:
        return floor_events

    # Exponential moving average of pressure
    ema = pressures[0]
    pressure_indices = [i for i, r in enumerate(readings) if r.pressure is not None]

    for idx, (pi, p) in enumerate(zip(pressure_indices, pressures)):
        ema = PRESSURE_SMOOTHING * p + (1 - PRESSURE_SMOOTHING) * ema
        delta = p - ema

        if abs(delta) > PRESSURE_FLOOR_THRESHOLD:
            direction = "up" if delta > 0 else "down"
            floor_events[pi] = direction

    return floor_events


def build_route(readings: List[RawReading]) -> List[RelativePoint]:
    """Main entry point: convert raw sensor readings to relative track points.

    Algorithm:
    1. Detect steps from accelerometer peaks.
    2. Integrate gyroscope for heading.
    3. For each step, compute position = previous + step_length × heading.
    4. Detect floor changes from barometer.
    5. Emit a RelativePoint at each step and at floor-change events.

    Returns ordered list of RelativePoint (sequence 0-based).
    """
    if not readings:
        return []

    step_indices = _detect_steps(readings)
    headings = _integrate_heading(readings)
    floor_events = _detect_floor_changes(readings)

    # All events (steps + floor changes) sorted by index
    events = set(step_indices)
    for idx in floor_events:
        events.add(idx)
    event_indices = sorted(events)

    points: List[RelativePoint] = []
    x, y, z = 0.0, 0.0, 0.0
    prev_step_idx = 0

    for seq, ei in enumerate(event_indices):
        heading_rad = math.radians(headings[ei])

        # Floor change events: adjust z
        fc = floor_events.get(ei)
        if fc == "up":
            z += 3.5  # ~3.5m per floor
        elif fc == "down":
            z -= 3.5

        # Step events: compute displacement
        is_step = ei in step_indices
        if is_step:
            dx = STEP_LENGTH_DEFAULT * math.sin(heading_rad)
            dy = STEP_LENGTH_DEFAULT * math.cos(heading_rad)
            x += dx
            y += dy

        points.append(RelativePoint(
            sequence=seq,
            relative_x=round(x, 4),
            relative_y=round(y, 4),
            relative_z=round(z, 4),
            relative_heading=round(headings[ei] % 360, 2),
            is_step=is_step,
            floor_change=fc,
        ))
        prev_step_idx = ei

    return points
