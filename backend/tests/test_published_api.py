from fastapi.testclient import TestClient

from surfacesignal.config import Settings
from surfacesignal.main import create_app
from surfacesignal.storage import checksum, write_json


def snapshot(root):
    base = root / "frontend/public/data/compact/api/v1"
    write_json(
        base / "scenes.json",
        {
            "items": [
                {
                    "scene_id": "one",
                    "area_id": "test",
                    "start_time": "2026-07-11T00:00:00Z",
                    "synthetic": False,
                },
                {
                    "scene_id": "two",
                    "area_id": "test",
                    "start_time": "2026-07-23T00:00:00Z",
                    "synthetic": False,
                },
            ],
            "total": 2,
            "offset": 0,
            "limit": 2,
        },
    )
    write_json(base / "areas.json", {"items": [], "total": 0, "offset": 0, "limit": 1})
    write_json(
        base / "publication-report.json",
        {"files": {p.name: checksum(p) for p in base.glob("*.json")}},
    )
    return base


def test_api_uses_published_data_without_raw_inputs_and_filters_utc(tmp_path):
    snapshot(tmp_path)
    client = TestClient(create_app(Settings(root=tmp_path)))
    response = client.get("/api/v1/scenes?area_id=test&start=2026-07-23&end=2026-07-23&limit=1")
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["scene_id"] == "two"
    assert client.get("/api/v1/scenes?limit=201").status_code == 422
    assert client.get("/api/v1/scenes?start=bad").status_code == 422
    assert client.get("/api/v1/scenes?start=2026-07-24&end=2026-07-11").status_code == 422
    assert (
        client.get("/api/v1/analyses/missing/environmental-context").json()["error"]["code"]
        == "context_not_prepared"
    )
    assert client.post("/api/v1/areas").status_code == 405


def test_api_rejects_modified_public_files(tmp_path):
    base = snapshot(tmp_path)
    client = TestClient(create_app(Settings(root=tmp_path)))
    (base / "scenes.json").write_text('{"items":[]}')
    response = client.get("/api/v1/scenes")
    assert response.status_code == 503
    assert str(tmp_path) not in response.text


def test_published_api_retains_cors_policy(tmp_path):
    snapshot(tmp_path)
    client = TestClient(create_app(Settings(root=tmp_path, cors_origins=["http://localhost:3000"])))
    response = client.get("/api/v1/scenes", headers={"Origin": "http://localhost:3000"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    response = client.get("/api/v1/scenes", headers={"Origin": "https://unapproved.example"})
    assert "access-control-allow-origin" not in response.headers


def test_published_response_links_are_followable_api_routes(tmp_path):
    base = snapshot(tmp_path)
    write_json(
        base / "analyses/one.json",
        {
            "links": {
                "statistics": "/data/compact/api/v1/analyses/one/statistics.json",
                "story": "/data/compact/api/v1/analyses/one/story.en.json",
            }
        },
    )
    write_json(base / "analyses/one/statistics.json", {"analysis_id": "one"})
    write_json(base / "analyses/one/story.en.json", {"lang": "en"})
    write_json(
        base / "publication-report.json",
        {
            "files": {
                str(p.relative_to(base)): checksum(p)
                for p in base.rglob("*.json")
                if p.name != "publication-report.json"
            }
        },
    )
    client = TestClient(create_app(Settings(root=tmp_path)))
    links = client.get("/api/v1/analyses/one").json()["links"]
    assert links["statistics"] == "/api/v1/analyses/one/statistics"
    assert links["story"] == "/api/v1/analyses/one/story?lang=en"
    assert all(client.get(link).status_code == 200 for link in links.values())


def test_published_general_order_uses_general_statistics(tmp_path):
    base = snapshot(tmp_path)
    items = [
        {
            "analysis_id": "one",
            "scenes": [
                {"start_time": "2026-07-11T00:00:00Z"},
                {"start_time": "2026-07-23T00:00:00Z"},
            ],
            "statistics": {"candidate_area_km2": 100},
        },
        {
            "analysis_id": "two",
            "scenes": [
                {"start_time": "2026-07-23T00:00:00Z"},
                {"start_time": "2026-08-01T00:00:00Z"},
            ],
            "statistics": {"candidate_area_km2": 1},
        },
    ]
    write_json(base / "analyses.json", {"items": items, "total": 2, "offset": 0, "limit": 2})
    for identifier, value in [("one", 1), ("two", 50)]:
        write_json(
            base / f"analyses/{identifier}/statistics.json",
            {
                "general_change": {
                    "statistics": {
                        "changed_area_km2": value,
                        "min_delta_db": -value,
                        "max_delta_db": value,
                        "increase_components": value,
                        "decrease_components": value,
                    }
                }
            },
        )
    write_json(
        base / "publication-report.json",
        {
            "files": {
                str(p.relative_to(base)): checksum(p)
                for p in base.rglob("*.json")
                if p.name != "publication-report.json"
            }
        },
    )
    client = TestClient(create_app(Settings(root=tmp_path)))
    for order in ["changed_area", "magnitude", "components"]:
        assert (
            client.get(f"/api/v1/analyses?sort_by={order}").json()["items"][0]["analysis_id"]
            == "two"
        )
