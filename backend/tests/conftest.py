import pytest
import requests
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
load_dotenv(FRONTEND_ENV)

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
).rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    """Direct MongoDB access to flip session status for the 400 'not recording' test."""
    from pymongo import MongoClient
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    yield client[db_name]
    client.close()


# NOTE: intentionally NO session-scoped cleanup fixture.
# With pytest-xdist LoadScopeScheduling, each worker has its own session and
# fires its own teardown independently. A wildcard cleanup by name prefix here
# would race and delete rows another worker still needs, producing false
# failures (verified). The DB is `test_database` — safe to leave test data.
