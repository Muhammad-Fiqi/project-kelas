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
