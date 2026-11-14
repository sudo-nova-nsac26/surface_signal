import json

import numpy as np
import pytest
from conftest import make_gcov
from fastapi.testclient import TestClient
from test_domain import scene

from surfacesignal.config import Settings
from surfacesignal.main import create_app
from surfacesignal.processing.pipeline import run_analysis
from surfacesignal.storage import write_json


@pytest.fixture
def prepared(tmp_path, area):
    before = make_gcov(tmp_path / "before.h5")
    data = np.full((4, 4), 0.001, dtype="float32")
    after = make_gcov(tmp_path / "after.h5", data, time="2026-07-23T21:33:50Z")
    a = scene(synthetic=True)
    b = scene(scene_id="synthetic-after", synthetic=True, start_time="2026-07-23T21:33:50Z")
    result = run_analysis(
        before, after, a, b, area, tmp_path / "artifacts", min_component_pixels=1, edge_pixels=0
    )
    return result, (before, after, a, b, area), tmp_path


def test_pipeline_reproducible_and_honest(prepared):
    result, args, root = prepared
    again = run_analysis(*args, root / "artifacts", min_component_pixels=1, edge_pixels=0)
    assert result == again
    assert result.evidence.synthetic and result.evidence.validation_status == "not_validated"
    assert result.evidence.confidence_level == "not_established"
    assert result.statistics["candidate_pixels"] == 16
    folder = root / "artifacts" / result.analysis_id
    assert set(result.artifacts) == {
        "before-preview.png",
        "after-preview.png",
        "delta-db.tif",
        "change-candidates.geojson",
        "statistics.json",
        "evidence.json",
    }
    geo = json.loads((folder / "change-candidates.geojson").read_text())
    assert geo["features"][0]["properties"]["synthetic"]
    assert -180 < geo["features"][0]["geometry"]["coordinates"][0][0][0] < 180


def test_pipeline_rejects_incomplete_artifact_hash_inventory(prepared):
    from surfacesignal.processing.pipeline import ArtifactIntegrityError
    from surfacesignal.storage import read_json

    result, args, root = prepared
    path = root / "artifacts" / result.analysis_id / "manifest.json"
    manifest = read_json(path)
    manifest["artifacts"] = {}
    write_json(path, manifest)
    with pytest.raises(ArtifactIntegrityError, match="integrity"):
        run_analysis(*args, root / "artifacts", min_component_pixels=1, edge_pixels=0)


def client_for(root, area):
    write_json(
        root / "config/areas/test.geojson",
        {
            "type": "Feature",
            "geometry": area.geometry,
            "properties": area.model_dump(exclude={"geometry"}),
        },
    )
    return TestClient(create_app(Settings(root=root)))


def test_api_offline_contracts_filters_and_artifacts(prepared):
    result, args, root = prepared
    client = client_for(root, args[-1])
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").json()["openapi"]
    assert client.get("/api/v1/areas").json()["total"] == 1
    assert client.get("/api/v1/analyses").json()["items"][0]["synthetic"]
    assert client.get("/api/v1/analyses?limit=0").status_code == 422
    assert client.get("/api/v1/scenes?start=oops").status_code == 422
    assert client.get("/api/v1/scenes?start=2026-08-01&end=2026-07-01").status_code == 422
    for route in ["areas", "scenes", "analyses"]:
        assert client.get("/api/v1/" + route + "/missing").status_code == 404
    base = "/api/v1/analyses/" + result.analysis_id
    assert client.get(base + "/evidence").json()["is_operational_alert"] is False
    assert client.get(base + "/artifacts/delta-db.tif").status_code == 200
    assert client.get(base + "/artifacts/anything.env").status_code == 404
    assert client.get(base + "/artifacts/%2e%2e%2f.env").status_code == 404
    assert client.get("/api/v1/sources").json()["total"] >= 3


def test_api_refuses_symlink_outside_analysis(prepared):
    result, args, root = prepared
    client = client_for(root, args[-1])
    target = root / "artifacts" / result.analysis_id / "before-preview.png"
    target.unlink()
    (root / "secret").write_text("DO_NOT_EXPOSE")
    target.symlink_to(root / "secret")
    r = client.get("/api/v1/analyses/" + result.analysis_id + "/artifacts/before-preview.png")
    assert r.status_code == 404 and "DO_NOT_EXPOSE" not in r.text


def test_api_corrupt_manifest_503_without_path_or_content(prepared):
    result, args, root = prepared
    client = client_for(root, args[-1])
    (root / "artifacts" / result.analysis_id / "manifest.json").write_text("SECRET bad json")
    response = client.get("/api/v1/analyses")
    assert response.status_code == 503 and "SECRET" not in response.text


def test_published_outputs_readable_by_non_owner_container_uid(prepared):
    import stat

    result, args, root = prepared
    folder = root / "artifacts" / result.analysis_id
    assert stat.S_IMODE(folder.stat().st_mode) & 0o005 == 0o005
    for path in folder.iterdir():
        assert stat.S_IMODE(path.stat().st_mode) & 0o004
    write_json(root / "data/catalog/test.json", {"area_id": "test", "scenes": []})
    assert stat.S_IMODE((root / "data/catalog/test.json").stat().st_mode) & 0o004


def test_structurally_invalid_catalog_is_sanitized_503(tmp_path, area):
    client = client_for(tmp_path, area)
    write_json(tmp_path / "data/catalog/test.json", {"wrong_key": "SECRET"})
    response = client.get("/api/v1/scenes")
    assert response.status_code == 503 and "SECRET" not in response.text


def test_scene_local_availability_is_computed_not_trusted_from_catalog(tmp_path, area):
    item = scene(size_bytes=4)
    write_json(
        tmp_path / "data/catalog/test.json",
        {"area_id": "test", "scenes": [item.model_dump(mode="json")]},
    )
    client = client_for(tmp_path, area)
    assert client.get("/api/v1/scenes/" + item.scene_id).json()["local_available"] is False
    raw = tmp_path / "data/raw"
    raw.mkdir()
    (raw / (item.scene_id + ".h5")).write_bytes(b"test")
    assert client.get("/api/v1/scenes/" + item.scene_id).json()["local_available"] is True
    assert client.get("/api/v1/scenes").json()["items"][0]["local_available"] is True
