"""Backend tests for MULEH navigation session + track point APIs."""
import uuid
import pytest


# ---------- health ----------
def test_health_root(api_client, base_url):
    r = api_client.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert r.json().get("message") == "Hello World"


# ---------- POST /api/sessions ----------
class TestCreateSession:
    def test_create_session_with_name(self, api_client, base_url):
        payload = {
            "name": "TEST_parking_mall",
            "start_point": {
                "latitude": -6.2088,
                "longitude": 106.8456,
                "altitude": 12.5,
                "accuracy": 4.0,
            },
        }
        r = api_client.post(f"{base_url}/api/sessions", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and isinstance(data["id"], str) and len(data["id"]) > 0
        assert data["name"] == "TEST_parking_mall"
        assert data["status"] == "recording"
        assert data["point_count"] == 0
        assert data["started_at"] is not None
        assert data["ended_at"] is None
        sp = data["start_point"]
        assert sp["latitude"] == -6.2088
        assert sp["longitude"] == 106.8456
        assert sp["altitude"] == 12.5
        assert sp["accuracy"] == 4.0

    def test_create_session_without_name(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"start_point": {"latitude": 1.0, "longitude": 2.0}},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["name"] is None
        assert data["status"] == "recording"
        assert data["point_count"] == 0
        assert data["start_point"]["altitude"] is None
        assert data["start_point"]["accuracy"] is None

    def test_create_session_missing_start_point(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/sessions", json={"name": "TEST_bad"})
        assert r.status_code == 422

    def test_create_session_defaults_to_imu_mode(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_default_mode", "start_point": {"latitude": 0, "longitude": 0}},
        )
        assert r.status_code == 200
        assert r.json()["tracking_mode"] == "imu"
        assert r.json()["reading_count"] == 0

    def test_create_session_explicit_gps_mode(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_gps_mode", "tracking_mode": "gps",
                  "start_point": {"latitude": -6.2, "longitude": 106.8}},
        )
        assert r.status_code == 200
        assert r.json()["tracking_mode"] == "gps"

    def test_no_mongo_object_id_in_response(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_no_oid", "start_point": {"latitude": 0, "longitude": 0}},
        )
        assert r.status_code == 200
        assert "_id" not in r.json()


# ---------- POST /api/sessions/{id}/points ----------
class TestAddTrackPoint:
    @pytest.fixture
    def session_id(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_single_points", "start_point": {"latitude": 0, "longitude": 0}},
        )
        assert r.status_code == 200
        return r.json()["id"]

    def test_add_single_point_sequence_starts_at_zero(self, api_client, base_url, session_id):
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/points",
            json={"latitude": 1.11, "longitude": 2.22, "accuracy": 5.0, "heading": 90.0},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["session_id"] == session_id
        assert data["sequence"] == 0
        assert data["latitude"] == 1.11
        assert data["longitude"] == 2.22
        assert data["heading"] == 90.0
        assert data["recorded_at"] is not None
        assert "_id" not in data

    def test_sequence_increments_and_point_count(self, api_client, base_url, session_id):
        # First
        r1 = api_client.post(
            f"{base_url}/api/sessions/{session_id}/points",
            json={"latitude": 1.0, "longitude": 1.0},
        )
        assert r1.status_code == 200
        assert r1.json()["sequence"] == 0
        # Second
        r2 = api_client.post(
            f"{base_url}/api/sessions/{session_id}/points",
            json={"latitude": 2.0, "longitude": 2.0},
        )
        assert r2.status_code == 200
        assert r2.json()["sequence"] == 1
        # Third
        r3 = api_client.post(
            f"{base_url}/api/sessions/{session_id}/points",
            json={"latitude": 3.0, "longitude": 3.0},
        )
        assert r3.status_code == 200
        assert r3.json()["sequence"] == 2

        # Verify point_count on session via route endpoint
        route = api_client.get(f"{base_url}/api/sessions/{session_id}/route").json()
        assert route["session"]["point_count"] == 3

    def test_point_unknown_session_returns_404(self, api_client, base_url):
        bogus = str(uuid.uuid4())
        r = api_client.post(
            f"{base_url}/api/sessions/{bogus}/points",
            json={"latitude": 0, "longitude": 0},
        )
        assert r.status_code == 404
        assert "not found" in r.json()["detail"].lower()

    def test_point_completed_session_returns_400(self, api_client, base_url, mongo_db):
        # create session then flip status directly
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_completed", "start_point": {"latitude": 0, "longitude": 0}},
        )
        assert r.status_code == 200
        sid = r.json()["id"]
        res = mongo_db.navigation_sessions.update_one(
            {"id": sid}, {"$set": {"status": "completed"}}
        )
        assert res.modified_count == 1
        r2 = api_client.post(
            f"{base_url}/api/sessions/{sid}/points",
            json={"latitude": 0, "longitude": 0},
        )
        assert r2.status_code == 400
        assert "not recording" in r2.json()["detail"].lower()


# ---------- POST /api/sessions/{id}/points/batch ----------
class TestAddTrackPointBatch:
    @pytest.fixture
    def session_id(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_batch", "start_point": {"latitude": 0, "longitude": 0}},
        )
        return r.json()["id"]

    def test_batch_empty_returns_empty_list(self, api_client, base_url, session_id):
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/points/batch",
            json={"points": []},
        )
        assert r.status_code == 200
        assert r.json() == []
        # point_count still 0
        route = api_client.get(f"{base_url}/api/sessions/{session_id}/route").json()
        assert route["session"]["point_count"] == 0

    def test_batch_sequences_start_from_zero(self, api_client, base_url, session_id):
        payload = {"points": [
            {"latitude": 1.0, "longitude": 1.0},
            {"latitude": 2.0, "longitude": 2.0},
            {"latitude": 3.0, "longitude": 3.0},
        ]}
        r = api_client.post(f"{base_url}/api/sessions/{session_id}/points/batch", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert [p["sequence"] for p in data] == [0, 1, 2]
        assert all(p["session_id"] == session_id for p in data)

    def test_batch_continues_from_point_count(self, api_client, base_url, session_id):
        # add 2 single points -> point_count = 2
        api_client.post(f"{base_url}/api/sessions/{session_id}/points",
                        json={"latitude": 0.0, "longitude": 0.0})
        api_client.post(f"{base_url}/api/sessions/{session_id}/points",
                        json={"latitude": 0.0, "longitude": 0.0})
        # batch of 3 -> sequences 2,3,4
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/points/batch",
            json={"points": [
                {"latitude": 10.0, "longitude": 10.0},
                {"latitude": 11.0, "longitude": 11.0},
                {"latitude": 12.0, "longitude": 12.0},
            ]},
        )
        assert r.status_code == 200
        assert [p["sequence"] for p in r.json()] == [2, 3, 4]
        route = api_client.get(f"{base_url}/api/sessions/{session_id}/route").json()
        assert route["session"]["point_count"] == 5
        assert len(route["points"]) == 5

    def test_batch_unknown_session_404(self, api_client, base_url):
        bogus = str(uuid.uuid4())
        r = api_client.post(
            f"{base_url}/api/sessions/{bogus}/points/batch",
            json={"points": [{"latitude": 0, "longitude": 0}]},
        )
        assert r.status_code == 404

    def test_batch_completed_session_400(self, api_client, base_url, mongo_db):
        sid = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_batch_completed",
                  "start_point": {"latitude": 0, "longitude": 0}},
        ).json()["id"]
        mongo_db.navigation_sessions.update_one({"id": sid}, {"$set": {"status": "completed"}})
        r = api_client.post(
            f"{base_url}/api/sessions/{sid}/points/batch",
            json={"points": [{"latitude": 0, "longitude": 0}]},
        )
        assert r.status_code == 400


# ---------- GET /api/sessions/{id}/route ----------
class TestGetSessionRoute:
    def test_route_returns_sorted_points(self, api_client, base_url):
        create = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_route",
                  "start_point": {"latitude": 5.0, "longitude": 6.0, "altitude": 10.0}},
        )
        assert create.status_code == 200, create.text
        sid = create.json()["id"]
        # add 4 points via batch
        pts = [
            {"latitude": 5.001, "longitude": 6.001},
            {"latitude": 5.002, "longitude": 6.002},
            {"latitude": 5.003, "longitude": 6.003},
            {"latitude": 5.004, "longitude": 6.004},
        ]
        b = api_client.post(f"{base_url}/api/sessions/{sid}/points/batch", json={"points": pts})
        assert b.status_code == 200, b.text

        r = api_client.get(f"{base_url}/api/sessions/{sid}/route")
        assert r.status_code == 200, f"sid={sid} body={r.text}"
        body = r.json()
        assert body["session"]["id"] == sid
        assert body["session"]["point_count"] == 4
        assert body["start_point"]["latitude"] == 5.0
        assert body["start_point"]["longitude"] == 6.0
        assert body["start_point"]["altitude"] == 10.0
        seqs = [p["sequence"] for p in body["points"]]
        assert seqs == sorted(seqs) == [0, 1, 2, 3]
        assert "_id" not in body["session"]
        for p in body["points"]:
            assert "_id" not in p

    def test_route_empty_points(self, api_client, base_url):
        sid = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_route_empty",
                  "start_point": {"latitude": 0, "longitude": 0}},
        ).json()["id"]
        r = api_client.get(f"{base_url}/api/sessions/{sid}/route")
        assert r.status_code == 200
        assert r.json()["points"] == []
        assert r.json()["session"]["point_count"] == 0

    def test_route_unknown_session_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/sessions/{uuid.uuid4()}/route")
        assert r.status_code == 404


# ---------- POST /api/sessions/{id}/sensor-readings/batch ----------
class TestSensorReadingBatch:
    @pytest.fixture
    def session_id(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_sensor", "start_point": {"latitude": 0, "longitude": 0}},
        )
        return r.json()["id"]

    def _make_reading(self, acc=(0.1, 0.2, 9.8), gyro=(0.01, -0.02, 0.03)):
        return {
            "accelerometer": {"x": acc[0], "y": acc[1], "z": acc[2]},
            "gyroscope": {"x": gyro[0], "y": gyro[1], "z": gyro[2]},
        }

    def test_batch_empty_returns_empty_list(self, api_client, base_url, session_id):
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch",
            json={"readings": []},
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_batch_sequences_start_from_zero(self, api_client, base_url, session_id):
        payload = {"readings": [self._make_reading() for _ in range(3)]}
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch", json=payload
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert [p["sequence"] for p in data] == [0, 1, 2]
        assert all(p["session_id"] == session_id for p in data)
        # each reading has accelerometer and gyroscope
        for rd in data:
            assert "accelerometer" in rd
            assert "gyroscope" in rd
            assert rd["recorded_at"] is not None
            assert "_id" not in rd

    def test_batch_increments_reading_count(self, api_client, base_url, session_id):
        # first batch of 2
        api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch",
            json={"readings": [self._make_reading(), self._make_reading()]},
        )
        # second batch of 3 -> sequences 2,3,4
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch",
            json={"readings": [self._make_reading() for _ in range(3)]},
        )
        assert r.status_code == 200
        assert [p["sequence"] for p in r.json()] == [2, 3, 4]

    def test_batch_with_optional_magnetometer_and_pressure(self, api_client, base_url, session_id):
        payload = {"readings": [{
            "accelerometer": {"x": 0.1, "y": 0.2, "z": 9.8},
            "gyroscope": {"x": 0.01, "y": -0.02, "z": 0.03},
            "magnetometer": {"x": 25.0, "y": -10.0, "z": 40.0},
            "pressure": 1013.25,
        }]}
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch", json=payload
        )
        assert r.status_code == 200
        rd = r.json()[0]
        assert rd["magnetometer"]["x"] == 25.0
        assert rd["pressure"] == 1013.25

    def test_batch_unknown_session_404(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions/{uuid.uuid4()}/sensor-readings/batch",
            json={"readings": [self._make_reading()]},
        )
        assert r.status_code == 404

    def test_batch_completed_session_400(self, api_client, base_url, mongo_db):
        sid = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_sensor_completed",
                  "start_point": {"latitude": 0, "longitude": 0}},
        ).json()["id"]
        mongo_db.navigation_sessions.update_one({"id": sid}, {"$set": {"status": "completed"}})
        r = api_client.post(
            f"{base_url}/api/sessions/{sid}/sensor-readings/batch",
            json={"readings": [self._make_reading()]},
        )
        assert r.status_code == 400


# ---------- GET /api/sessions/{id}/sensor-readings ----------
class TestGetSensorReadings:
    @pytest.fixture
    def session_id(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_get_sensor", "start_point": {"latitude": 0, "longitude": 0}},
        )
        return r.json()["id"]

    def _make_reading(self, seq_offset=0):
        return {
            "accelerometer": {"x": 0.1 * seq_offset, "y": 0.2, "z": 9.8},
            "gyroscope": {"x": 0.01, "y": -0.02, "z": 0.03},
        }

    def test_returns_sorted_readings(self, api_client, base_url, session_id):
        # insert 3 readings
        api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch",
            json={"readings": [self._make_reading(i) for i in range(3)]},
        )
        r = api_client.get(f"{base_url}/api/sessions/{session_id}/sensor-readings")
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) == 3
        assert [d["sequence"] for d in data] == [0, 1, 2]
        for d in data:
            assert "_id" not in d

    def test_empty_readings_returns_empty_list(self, api_client, base_url, session_id):
        r = api_client.get(f"{base_url}/api/sessions/{session_id}/sensor-readings")
        assert r.status_code == 200
        assert r.json() == []

    def test_unknown_session_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/sessions/{uuid.uuid4()}/sensor-readings")
        assert r.status_code == 404

    def test_respects_limit_param(self, api_client, base_url, session_id):
        api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch",
            json={"readings": [self._make_reading(i) for i in range(10)]},
        )
        r = api_client.get(f"{base_url}/api/sessions/{session_id}/sensor-readings?limit=3")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 3
        assert data[0]["sequence"] == 0


# ---------- IMU-relative track points (no GPS) ----------
class TestIMURelativeTrackPoints:
    @pytest.fixture
    def session_id(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_imu_points", "start_point": {"latitude": 0, "longitude": 0}},
        )
        return r.json()["id"]

    def test_add_imu_relative_point(self, api_client, base_url, session_id):
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/points",
            json={"relative_x": 1.2, "relative_y": 0.5, "relative_z": 0.0, "relative_heading": 45.0},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["sequence"] == 0
        assert data["relative_x"] == 1.2
        assert data["relative_y"] == 0.5
        assert data["relative_heading"] == 45.0
        assert data["latitude"] is None
        assert data["longitude"] is None

    def test_batch_imu_relative_points(self, api_client, base_url, session_id):
        payload = {"points": [
            {"relative_x": 0.0, "relative_y": 0.0},
            {"relative_x": 1.0, "relative_y": 0.0, "relative_heading": 90.0},
            {"relative_x": 1.0, "relative_y": 1.0, "relative_z": 4.5, "relative_heading": 45.0},
        ]}
        r = api_client.post(f"{base_url}/api/sessions/{session_id}/points/batch", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 3
        assert data[0]["relative_x"] == 0.0
        assert data[2]["relative_z"] == 4.5
        assert [p["sequence"] for p in data] == [0, 1, 2]

    def test_gps_point_still_works_on_imu_session(self, api_client, base_url, session_id):
        """Even on an IMU session, GPS fields should be accepted (mixed mode)."""
        r = api_client.post(
            f"{base_url}/api/sessions/{session_id}/points",
            json={"latitude": -6.2088, "longitude": 106.8456, "relative_x": 1.0, "relative_y": 0.0},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["latitude"] == -6.2088
        assert data["relative_x"] == 1.0

    def test_route_returns_imu_points(self, api_client, base_url, session_id):
        api_client.post(
            f"{base_url}/api/sessions/{session_id}/points/batch",
            json={"points": [
                {"relative_x": 0.0, "relative_y": 0.0},
                {"relative_x": 2.5, "relative_y": 1.0, "relative_heading": 22.0},
        ]},
        )
        r = api_client.get(f"{base_url}/api/sessions/{session_id}/route")
        assert r.status_code == 200
        pts = r.json()["points"]
        assert len(pts) == 2
        assert pts[1]["relative_x"] == 2.5
        assert pts[1]["relative_heading"] == 22.0


# ---------- Session CRUD (list, get, complete, delete) ----------
class TestSessionCRUD:
    @pytest.fixture
    def session_id(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_crud", "start_point": {"latitude": 0, "longitude": 0}},
        )
        return r.json()["id"]

    def test_list_sessions(self, api_client, base_url, session_id):
        r = api_client.get(f"{base_url}/api/sessions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(s["id"] == session_id for s in data)

    def test_get_single_session(self, api_client, base_url, session_id):
        r = api_client.get(f"{base_url}/api/sessions/{session_id}")
        assert r.status_code == 200
        assert r.json()["id"] == session_id
        assert r.json()["status"] == "recording"

    def test_get_unknown_session_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/sessions/{uuid.uuid4()}")
        assert r.status_code == 404

    def test_complete_session(self, api_client, base_url, session_id):
        r = api_client.post(f"{base_url}/api/sessions/{session_id}/complete")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "completed"
        assert data["ended_at"] is not None

    def test_complete_already_completed_400(self, api_client, base_url, session_id):
        api_client.post(f"{base_url}/api/sessions/{session_id}/complete")
        r = api_client.post(f"{base_url}/api/sessions/{session_id}/complete")
        assert r.status_code == 400
        assert "already" in r.json()["detail"].lower()

    def test_complete_unknown_session_404(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/sessions/{uuid.uuid4()}/complete")
        assert r.status_code == 404

    def test_delete_session(self, api_client, base_url, session_id):
        # Add a point first
        api_client.post(
            f"{base_url}/api/sessions/{session_id}/points",
            json={"relative_x": 1.0, "relative_y": 0.0},
        )
        r = api_client.delete(f"{base_url}/api/sessions/{session_id}")
        assert r.status_code == 200
        assert r.json()["deleted"] is True
        # Verify gone
        r2 = api_client.get(f"{base_url}/api/sessions/{session_id}")
        assert r2.status_code == 404

    def test_delete_unknown_session_404(self, api_client, base_url):
        r = api_client.delete(f"{base_url}/api/sessions/{uuid.uuid4()}")
        assert r.status_code == 404


def test_save_unknown_session_404(self, api_client, base_url):
    r = api_client.post(f"{base_url}/api/sessions/{uuid.uuid4()}/save", json={"name": "x"})
    assert r.status_code == 404

def test_save_already_completed_400(self, api_client, base_url):
    sid = api_client.post(
        f"{base_url}/api/sessions",
        json={"name": "TEST_save_400", "start_point": {"latitude": 0, "longitude": 0}},
    ).json()["id"]
    api_client.post(f"{base_url}/api/sessions/{sid}/complete")
    r = api_client.post(f"{base_url}/api/sessions/{sid}/save", json={"name": "y"})
    assert r.status_code == 400


def test_save_sets_name_and_completes(self, api_client, base_url):
    sid = api_client.post(
        f"{base_url}/api/sessions",
        json={"start_point": {"latitude": 0, "longitude": 0}},
    ).json()["id"]
    r = api_client.post(f"{base_url}/api/sessions/{sid}/save", json={"name": "Parkiran LT.2"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Parkiran LT.2"
    assert data["status"] == "completed"
    assert data["ended_at"] is not None

def test_save_without_name(self, api_client, base_url):
    sid = api_client.post(
        f"{base_url}/api/sessions",
        json={"start_point": {"latitude": 0, "longitude": 0}},
    ).json()["id"]
    r = api_client.post(f"{base_url}/api/sessions/{sid}/save", json={"name": None})
    assert r.status_code == 200
    assert r.json()["status"] == "completed"

def test_summary_returns_lightweight(self, api_client, base_url):
    sid = api_client.post(
        f"{base_url}/api/sessions",
        json={"name": "TEST_summary", "start_point": {"latitude": 0, "longitude": 0}},
    ).json()["id"]
    r = api_client.get(f"{base_url}/api/sessions/summary")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    found = [s for s in data if s["id"] == sid]
    assert len(found) == 1
    assert found[0]["name"] == "TEST_summary"
    assert found[0]["point_count"] == 0
    assert found[0]["duration_sec"] is None  # not completed
    assert found[0]["has_route"] is False
    assert "start_point" not in found[0]  # lightweight


# ---------- POST /api/sessions/{id}/build-route ----------
class TestBuildRoute:
    @pytest.fixture
    def session_id(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/sessions",
            json={"name": "TEST_build_route", "start_point": {"latitude": 0, "longitude": 0}},
        )
        return r.json()["id"]

    def _make_reading(self, acc_z=9.8, gyro_z=0.0, pressure=None):
        return {
            "accelerometer": {"x": 0.1, "y": 0.2, "z": acc_z},
            "gyroscope": {"x": 0.0, "y": 0.0, "z": gyro_z},
            **({"pressure": pressure} if pressure is not None else {}),
        }

    def test_empty_readings_returns_empty_route(self, api_client, base_url, session_id):
        r = api_client.post(f"{base_url}/api/sessions/{session_id}/build-route")
        assert r.status_code == 200
        body = r.json()
        assert body["input_readings"] == 0
        assert body["output_points"] == 0
        assert body["points"] == []

    def test_build_route_produces_points(self, api_client, base_url, session_id):
        # Simulate 90 readings (3 sec at 30Hz) with 2 step-like peaks
        readings = []
        for i in range(90):
            acc_z = 11.5 if i in (15, 60) else 9.8  # step peaks
            gyro_z = 0.5 if 30 <= i <= 45 else 0.0  # turn
            readings.append(self._make_reading(acc_z=acc_z, gyro_z=gyro_z))

        api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch",
            json={"readings": readings},
        )
        r = api_client.post(f"{base_url}/api/sessions/{session_id}/build-route")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["input_readings"] == 90
        assert body["output_points"] >= 2  # at least 2 step points
        assert body["session_id"] == session_id
        # Points should have relative coordinates
        for p in body["points"]:
            assert "relative_x" in p
            assert "relative_y" in p
            assert "is_step" in p

    def test_build_route_unknown_session_404(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/sessions/{uuid.uuid4()}/build-route")
        assert r.status_code == 404

    def test_build_route_with_floor_change(self, api_client, base_url, session_id):
        readings = []
        for i in range(90):
            acc_z = 11.5 if i == 15 else 9.8
            pressure = 1015.0 if 40 <= i <= 50 else 1013.25  # pressure spike
            readings.append(self._make_reading(acc_z=acc_z, pressure=pressure))
        api_client.post(
            f"{base_url}/api/sessions/{session_id}/sensor-readings/batch",
            json={"readings": readings},
        )
        r = api_client.post(f"{base_url}/api/sessions/{session_id}/build-route")
        assert r.status_code == 200
        body = r.json()
        floor_points = [p for p in body["points"] if p.get("floor_change")]
        assert len(floor_points) >= 1


# ---------- Unit tests for route_builder module ----------
class TestRouteBuilderAlgorithm:
    def test_empty_input(self):
        from route_builder import build_route
        assert build_route([]) == []

    def test_single_step(self):
        from route_builder import build_route, RawReading
        readings = [RawReading(
            sequence=0, acc_x=0.1, acc_y=0.2, acc_z=9.8,
            gyro_x=0, gyro_y=0, gyro_z=0,
        )]
        # Single reading below threshold — no step detected
        result = build_route(readings)
        assert len(result) == 0

    def test_step_detection(self):
        from route_builder import build_route, RawReading
        # Create 60 readings with a peak at index 30 (above threshold)
        readings = []
        for i in range(60):
            acc_z = 11.5 if i == 30 else 9.8
            readings.append(RawReading(
                sequence=i, acc_x=0.1, acc_y=0.2, acc_z=acc_z,
                gyro_x=0, gyro_y=0, gyro_z=0,
            ))
        result = build_route(readings)
        steps = [p for p in result if p.is_step]
        assert len(steps) >= 1

    def test_heading_integration_with_gyro(self):
        from route_builder import build_route, RawReading
        readings = []
        for i in range(90):
            acc_z = 11.5 if i in (15, 60) else 9.8
            gyro_z = 1.0  # constant turn
            readings.append(RawReading(
                sequence=i, acc_x=0.1, acc_y=0.2, acc_z=acc_z,
                gyro_x=0, gyro_y=0, gyro_z=gyro_z,
            ))
        result = build_route(readings)
        # All points should have non-zero heading due to constant gyro
        for p in result:
            assert p.relative_heading != 0.0
