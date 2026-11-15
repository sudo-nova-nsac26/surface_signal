# ruff: noqa: F811
from test_pipeline_api import client_for, prepared  # noqa: F401

from surfacesignal.storage import write_json


def setup(prepared):
    a, args, root = prepared
    write_json(
        root / "data/catalog/test.json",
        {"area_id": "test", "scenes": [s.model_dump(mode="json") for s in args[2:4]]},
    )
    return a, client_for(root, args[-1])


def test_mvp_endpoints_and_missing_derived(prepared):
    a, client = setup(prepared)
    for path in [
        "capabilities",
        "methodology",
        "stories",
        "layers",
        "areas/test/overview",
        "areas/test/timeline",
        f"analyses/{a.analysis_id}/statistics",
        f"analyses/{a.analysis_id}/layers",
        f"analyses/{a.analysis_id}/story",
    ]:
        r = client.get("/api/v1/" + path)
        assert r.status_code == 200, (path, r.text)
    timeline = client.get("/api/v1/areas/test/timeline").json()
    assert timeline["scene_count"] == 2 and timeline["comparison_count"] == 1
    assert timeline["comparisons"][0]["analysis_ids"] == [a.analysis_id]
    assert timeline["data_status"] == "synthetic"
    overview = client.get("/api/v1/areas/test/overview").json()
    assert "total_changed_area_km2" not in overview
    assert overview["availability"] == "available"
    assert client.get("/api/v1/stories?lang=fr").status_code == 422
    assert client.get("/api/v1/areas/missing/timeline").status_code == 404
    assert client.get("/api/v1/analyses/missing/story").status_code == 404
    assert (
        client.get("/api/v1/analyses?sort_by=magnitude&exclude_synthetic=true").json()["total"] == 0
    )
    spec = client.get("/openapi.json").json()
    assert spec["info"]["title"] == "SurfaceSignal API"
    for path in ["/api/v1/capabilities", "/api/v1/areas/{area_id}/timeline"]:
        assert spec["paths"][path]["get"]["responses"]["200"]["content"]["application/json"][
            "schema"
        ]


def test_derived_exposed_without_raw_access(prepared):
    from surfacesignal.processing.general_change import derive_analysis

    a, client = setup(prepared)
    derive_analysis(prepared[-1], a.analysis_id, min_component_pixels=1)
    for p in prepared[1][:2]:
        p.unlink()
    base = "/api/v1/analyses/" + a.analysis_id
    assert (
        client.get(base + "/statistics").json()["general_change"]["statistics"]["decrease_pixels"]
        == 16
    )
    layers = client.get(base + "/layers").json()["items"]
    assert next(x for x in layers if x["layer_id"] == "radar_decrease")["available"]
    geo = client.get(base + "/artifacts/radar-decrease.geojson")
    assert geo.status_code == 200 and len(geo.json()["features"]) == 1
    assert "ETag" in geo.headers
    assert client.get(base + "/story?lang=en").json()["data_status"] == "synthetic"


def test_empty_states(prepared):
    a, client = setup(prepared)
    root = prepared[-1]
    write_json(root / "data/catalog/test.json", {"area_id": "test", "scenes": []})
    # Analyses retain their source observations even when the catalog is absent.
    assert client.get("/api/v1/areas/test/timeline").json()["scene_count"] == 2


def test_symlinked_manifest_does_not_leak(prepared):
    a, client = setup(prepared)
    root = prepared[-1]
    manifest = root / "artifacts" / a.analysis_id / "manifest.json"
    outside = root / "private.json"
    outside.write_bytes(manifest.read_bytes())
    manifest.unlink()
    manifest.symlink_to(outside)
    assert client.get("/api/v1/analyses/" + a.analysis_id).status_code in (404, 503)


def test_source_change_after_warm_cache_is_unavailable(prepared):
    from surfacesignal.processing.general_change import derive_analysis
    from surfacesignal.storage import read_json

    a, client = setup(prepared)
    root = prepared[-1]
    derive_analysis(root, a.analysis_id, min_component_pixels=1)
    url = "/api/v1/analyses/" + a.analysis_id + "/statistics"
    assert client.get(url).status_code == 200
    path = root / "artifacts" / a.analysis_id / "manifest.json"
    manifest = read_json(path)
    manifest["parameters"]["water_threshold"] = -99
    write_json(path, manifest)
    assert client.get(url).status_code == 503


def test_incompatible_stored_analysis_rejected(prepared):
    from surfacesignal.storage import read_json

    a, client = setup(prepared)
    path = prepared[-1] / "artifacts" / a.analysis_id / "manifest.json"
    manifest = read_json(path)
    manifest["scenes"][1]["track"] = 999
    write_json(path, manifest)
    assert client.get("/api/v1/analyses/" + a.analysis_id).status_code == 503


def test_empty_region_states_and_cors(tmp_path, area):
    from fastapi.testclient import TestClient
    from test_domain import scene

    from surfacesignal.config import Settings
    from surfacesignal.main import create_app

    client_for(tmp_path, area)
    client = TestClient(create_app(Settings(root=tmp_path, cors_origins=["http://localhost:3000"])))
    url = "/api/v1/areas/test/overview"
    assert client.get(url).json()["availability"] == "no_observations"
    first = scene(synthetic=True, maturity="PROVISIONAL")
    write_json(
        tmp_path / "data/catalog/test.json",
        {"area_id": "test", "scenes": [first.model_dump(mode="json")]},
    )
    assert client.get(url).json()["availability"] == "no_compatible_pairs"
    second = scene(
        scene_id="second", synthetic=True, maturity="PROVISIONAL", start_time="2026-07-23T21:33:50Z"
    )
    write_json(
        tmp_path / "data/catalog/test.json",
        {"area_id": "test", "scenes": [s.model_dump(mode="json") for s in [first, second]]},
    )
    assert client.get(url).json()["availability"] == "not_processed"
    allowed = client.options(
        url, headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"}
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    denied = client.options(
        url, headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"}
    )
    assert denied.status_code == 400
    assert client.post(url).status_code == 405


def test_openapi_examples_validate_against_models(prepared):
    from surfacesignal.api.schemas import LayerIndex, Overview, Statistics, Timeline
    from surfacesignal.domain import Page
    from surfacesignal.interpretation.models import Capability, Methodology, Stories, Story

    _, client = setup(prepared)
    paths = client.get("/openapi.json").json()["paths"]
    for path, model in [
        ("capabilities", Page[Capability]),
        ("methodology", Methodology),
        ("stories", Stories),
        ("layers", LayerIndex),
        ("areas/{area_id}/overview", Overview),
        ("areas/{area_id}/timeline", Timeline),
        ("analyses/{analysis_id}/statistics", Statistics),
        ("analyses/{analysis_id}/story", Story),
    ]:
        payload = paths["/api/v1/" + path]["get"]["responses"]["200"]["content"][
            "application/json"
        ]["examples"]["illustrative"]["value"]
        model.model_validate(payload)
