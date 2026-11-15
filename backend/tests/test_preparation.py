# ruff: noqa: F811
import pytest
from test_pipeline_api import client_for, prepared  # noqa: F401
from test_preparation_context import context_file

from surfacesignal.api.service import Repository
from surfacesignal.config import Settings
from surfacesignal.preparation.models import Budgets
from surfacesignal.processing.general_change import derive_analysis
from surfacesignal.storage import read_json, write_json


def setup(prepared):
    analysis, args, root = prepared
    client_for(root, args[-1])
    derive_analysis(root, analysis.analysis_id, min_component_pixels=1)
    return Repository(Settings(root=root))


def test_report_default_excludes_synthetic_and_keeps_generic_guidance(prepared):
    from surfacesignal.preparation.engine import assemble

    repo = setup(prepared)
    result = assemble(repo, "test", Budgets())
    report = result["payloads"]["local-analysis.pt.json"]
    assert report["data_status"] == "no_data" and report["observations"] == []
    assert report["context_status"] == "unavailable"
    for audience in ("residents", "municipal"):
        for lang in ("pt", "en"):
            plan = result["payloads"][f"preparation.{audience}.{lang}.json"]
            assert plan["status"] == "proposed" and not plan["is_operational_alert"]
            assert plan["actions"] and all(
                a["basis"] == "general_guidance" for a in plan["actions"]
            )
            assert all(not a["evidence_ids"] for a in plan["actions"])
            assert plan["sources"]


def test_illustrative_report_uses_actual_metrics_and_preserves_times(prepared):
    from surfacesignal.preparation.engine import assemble

    repo = setup(prepared)
    analysis = prepared[0]
    result = assemble(repo, "test", Budgets(), illustrative=True)
    report = result["payloads"]["local-analysis.en.json"]
    assert report["data_status"] == "synthetic"
    obs = report["observations"][0]
    assert obs["analysis_id"] == analysis.analysis_id
    assert obs["water_candidate_area_km2"] == pytest.approx(0.0064)
    assert obs["valid_area_km2"] == pytest.approx(0.0064)
    assert obs["before_time"] == "2026-07-11T21:33:51Z"
    assert obs["after_time"] == "2026-07-23T21:33:50Z"
    assert obs["local_relations"] is None
    assert obs["parameters"] == analysis.parameters
    assert "total_changed_area_km2" not in report
    assert report["validation_status"] == "not_validated"
    assert len(result["payloads"]) == 6


def test_conditional_municipal_tasks_require_positive_evidence(prepared):
    from surfacesignal.preparation.context import read_context
    from surfacesignal.preparation.engine import assemble

    repo = setup(prepared)
    path = context_file(prepared[-1])
    value = read_json(path)
    # Put the illustrative facility inside the fixture's actual georeferenced candidate.
    geo = read_json(
        prepared[-1] / "artifacts" / prepared[0].analysis_id / "change-candidates.geojson"
    )
    value["features"][0]["geometry"] = geo["features"][0]["geometry"]
    write_json(path, value)
    ctx = read_context(path, Budgets())
    result = assemble(repo, "test", Budgets(), context=ctx, illustrative=True)
    municipal = result["payloads"]["preparation.municipal.pt.json"]
    tasks = [a for a in municipal["actions"] if a["basis"] == "observed_overlap"]
    assert tasks and all(a["feature_id"] == "school" and a["evidence_ids"] for a in tasks)
    assert all(a["origin"] == "surfacesignal_proposal" for a in tasks)
    residents = result["payloads"]["preparation.residents.pt.json"]
    assert all(a["basis"] == "general_guidance" for a in residents["actions"])
    with pytest.raises(ValueError, match="synthetic"):
        assemble(repo, "test", Budgets(), context=ctx)


def test_store_idempotence_tampering_and_budget_preserve_pointer(prepared):
    from surfacesignal.preparation.store import build_preparation, load_preparation

    setup(prepared)
    settings = Settings(root=prepared[-1])
    first = build_preparation(settings, "test", illustrative=True)
    assert build_preparation(settings, "test", illustrative=True) == first
    base = prepared[-1] / "data/preparation/test"
    pointer = (base / "current.json").read_bytes()
    with pytest.raises(ValueError, match="budget"):
        build_preparation(settings, "test", budgets=Budgets(max_output_bytes=1))
    assert (base / "current.json").read_bytes() == pointer
    assert load_preparation(settings, "test")["manifest"]["report_id"] == first["report_id"]
    folder = base / first["report_id"]
    assert "Illustrative" in (folder / "report.en.md").read_text()
    (folder / "unexpected.json").write_text("{}")
    with pytest.raises(ValueError):
        load_preparation(settings, "test")


@pytest.mark.parametrize("tamper", ["source", "derivative", "output", "area", "pointer", "symlink"])
def test_prepared_store_rejects_stale_or_corrupt_data(prepared, tamper):
    from surfacesignal.preparation.store import build_preparation, load_preparation

    repo = setup(prepared)
    manifest = build_preparation(repo.settings, "test", illustrative=True)
    root = prepared[-1]
    folder = root / "data/preparation/test" / manifest["report_id"]
    if tamper == "source":
        path = root / "artifacts" / prepared[0].analysis_id / "manifest.json"
        value = read_json(path)
        value["parameters"]["water_threshold"] = -100
        write_json(path, value)
    elif tamper == "derivative":
        d = repo.derived(prepared[0])
        path = (
            root
            / "data/derived"
            / prepared[0].analysis_id
            / d["derived_id"]
            / "general-change.geojson"
        )
        path.write_text("{}")
    elif tamper == "output":
        (folder / "preparation.residents.pt.json").write_text("{}")
    elif tamper == "area":
        path = root / "config/areas/test.geojson"
        value = read_json(path)
        value["properties"]["name"] = "Changed area"
        write_json(path, value)
    elif tamper == "pointer":
        write_json(root / "data/preparation/test/current.json", {"report_id": "../outside"})
    else:
        path = folder / "report.pt.md"
        copy = root / "outside.md"
        copy.write_bytes(path.read_bytes())
        path.unlink()
        path.symlink_to(copy)
    with pytest.raises(ValueError):
        load_preparation(repo.settings, "test")


def test_context_snapshot_independent_of_original_path(prepared):
    from surfacesignal.preparation.store import build_preparation, load_preparation

    repo = setup(prepared)
    path = context_file(prepared[-1])
    build_preparation(repo.settings, "test", context_path=path, illustrative=True)
    path.unlink()
    assert (
        load_preparation(repo.settings, "test")["payloads"]["local-analysis.pt.json"][
            "context_status"
        ]
        == "available"
    )


def test_interrupted_build_keeps_current(prepared, monkeypatch):
    from surfacesignal.preparation import store

    repo = setup(prepared)
    store.build_preparation(repo.settings, "test", illustrative=True)
    pointer = prepared[-1] / "data/preparation/test/current.json"
    previous = pointer.read_bytes()
    original = store.write_json

    def interrupted(path, value):
        if path.name == "manifest.json":
            raise OSError("Simulated write failure")
        original(path, value)

    monkeypatch.setattr(store, "write_json", interrupted)
    with pytest.raises(OSError):
        store.build_preparation(repo.settings, "test")
    assert pointer.read_bytes() == previous


def test_every_action_source_resolves_in_plan(prepared):
    from surfacesignal.preparation.context import read_context
    from surfacesignal.preparation.engine import assemble

    repo = setup(prepared)
    path = context_file(prepared[-1])
    value = read_json(path)
    geo = read_json(
        prepared[-1] / "artifacts" / prepared[0].analysis_id / "change-candidates.geojson"
    )
    value["features"][0]["geometry"] = geo["features"][0]["geometry"]
    write_json(path, value)
    result = assemble(
        repo, "test", Budgets(), context=read_context(path, Budgets()), illustrative=True
    )
    plan = result["payloads"]["preparation.municipal.en.json"]
    ids = {s["source_id"] for s in plan["sources"]}
    assert all(set(a["source_ids"]) <= ids for a in plan["actions"])
    assert all(a["evidence_ids"] for a in plan["actions"] if a["basis"] == "observed_overlap")


def test_new_selected_analysis_invalidates_prepared_report(prepared):
    from surfacesignal.preparation.store import build_preparation, load_preparation

    repo = setup(prepared)
    build_preparation(repo.settings, "test", illustrative=True)
    import shutil

    source = prepared[-1] / "artifacts" / prepared[0].analysis_id
    added = prepared[-1] / "artifacts/added"
    shutil.copytree(source, added)
    value = read_json(added / "manifest.json")
    value["analysis_id"] = "added"
    write_json(added / "manifest.json", value)
    with pytest.raises(ValueError):
        load_preparation(repo.settings, "test")


def test_api_verification_never_opens_rasters(prepared, monkeypatch):
    from pathlib import Path

    from surfacesignal.preparation.store import build_preparation, load_preparation

    repo = setup(prepared)
    build_preparation(repo.settings, "test", illustrative=True)
    original = Path.open

    def no_rasters(path, *args, **kwargs):
        if path.suffix in {".tif", ".h5", ".hdf5"}:
            raise AssertionError("HTTP verification must not open raster or raw files")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", no_rasters)
    assert load_preparation(repo.settings, "test")["manifest"]["report_id"]


def test_derivative_budget_checked_before_reading_or_hashing(prepared, monkeypatch):
    from surfacesignal.preparation import engine

    repo = setup(prepared)
    d = repo.derived(prepared[0])
    path = (
        prepared[-1]
        / "data/derived"
        / prepared[0].analysis_id
        / d["derived_id"]
        / "general-change.geojson"
    )
    # Source manifests are smaller than this deliberately over-budget derivative.
    path.write_bytes(b"x" * 50_001)
    original = engine.load_derived

    def guard(*args, **kwargs):
        raise AssertionError("Over-budget derivative must be rejected before verified loader")

    monkeypatch.setattr(engine, "load_derived", guard)
    with pytest.raises(ValueError, match="budget"):
        engine.inputs(repo, "test", Budgets(max_input_bytes=50_000), illustrative=True)
    monkeypatch.setattr(engine, "load_derived", original)


def test_original_budget_checked_before_full_verification(prepared, monkeypatch):
    from surfacesignal.preparation import engine

    repo = setup(prepared)
    path = prepared[-1] / "artifacts" / prepared[0].analysis_id / "change-candidates.geojson"
    path.write_bytes(b"x" * 50_001)

    def should_not_verify(*args, **kwargs):
        raise AssertionError("Input budget must precede full verification")

    monkeypatch.setattr(engine, "verify_artifacts", should_not_verify)
    with pytest.raises(ValueError, match="budget"):
        engine.inputs(repo, "test", Budgets(max_input_bytes=50_000), illustrative=True, full=True)


def test_warm_read_rejects_area_change_with_same_timestamp_and_size(prepared):
    import os

    from surfacesignal.preparation.store import build_preparation, load_preparation

    repo = setup(prepared)
    build_preparation(repo.settings, "test", illustrative=True)
    assert (
        load_preparation(repo.settings, "test")["payloads"]["local-analysis.en.json"]["area_name"]
        == "Synthetic test AOI"
    )
    path = prepared[-1] / "config/areas/test.geojson"
    original = path.stat()
    contents = path.read_text().replace("Synthetic test AOI", "Different test AOI")
    path.write_text(contents)
    os.utime(path, ns=(original.st_atime_ns, original.st_mtime_ns))
    assert path.stat().st_size == original.st_size
    with pytest.raises(ValueError, match="invalid"):
        load_preparation(repo.settings, "test")


def test_warm_read_rechecks_excluded_manifest_bytes(prepared):
    import os

    from surfacesignal.preparation.store import build_preparation, load_preparation

    repo = setup(prepared)
    # Real-only report excludes this fixture, but still must not trust stale metadata.
    build_preparation(repo.settings, "test")
    repo.analysis(prepared[0].analysis_id)
    path = prepared[-1] / "artifacts" / prepared[0].analysis_id / "manifest.json"
    original = path.stat()
    text = path.read_text().replace('"synthetic": true', '"synthetic": null', 1)
    assert len(text.encode()) == original.st_size
    path.write_text(text)
    os.utime(path, ns=(original.st_atime_ns, original.st_mtime_ns))
    with pytest.raises(ValueError):
        load_preparation(repo.settings, "test")
