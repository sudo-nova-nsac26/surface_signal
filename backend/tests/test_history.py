from collections import Counter
from datetime import date
from pathlib import Path

import pytest
from test_domain import scene

from surfacesignal.config import Settings
from surfacesignal.domain import CatalogSnapshot
from surfacesignal.processing.history import candidate_pairs, plan_history
from surfacesignal.providers.asf import ProviderError
from surfacesignal.storage import read_json, write_json

REPOSITORY = Path(__file__).resolve().parents[2]
SNAPSHOT = REPOSITORY / "docs/evidence/asf-catalog.json"


def configure(tmp_path, area):
    write_json(
        tmp_path / "config/areas/test.geojson",
        {
            "type": "Feature",
            "geometry": area.geometry,
            "properties": area.model_dump(exclude={"geometry"}),
        },
    )
    snapshot = tmp_path / "snapshot.json"
    write_json(
        snapshot,
        CatalogSnapshot(
            area_id="test",
            query={"start": "2026-06-17", "dataMaturity": "PROVISIONAL"},
            scenes=[scene(maturity="PROVISIONAL", size_bytes=100)],
        ).model_dump(mode="json"),
    )
    return Settings(root=tmp_path), snapshot


def test_fixed_snapshot_totals_and_consecutive_pairs(tmp_path):
    settings = Settings(root=tmp_path)
    (tmp_path / "config/areas").mkdir(parents=True)
    (tmp_path / "config/areas/vale-do-taquari.geojson").write_bytes(
        (REPOSITORY / "config/areas/vale-do-taquari.geojson").read_bytes()
    )
    plan = plan_history(settings, SNAPSHOT)
    assert len(plan["mandatory_ids"]) == len(set(plan["mandatory_ids"])) == 19
    assert sum(s["size_bytes"] for s in plan["catalog"]["scenes"]) == 131_386_572_800
    lookup = {s["scene_id"]: s for s in plan["catalog"]["scenes"]}
    assert Counter(lookup[p["before"]]["direction"] for p in plan["pairs"]) == {
        "DESCENDING": 9,
        "ASCENDING": 8,
    }
    assert plan["parameters"]["frequency"] == "A"
    assert plan["parameters"]["channel"] == "HHHH"
    assert len(plan["snapshot"]["sha256"]) == 64
    assert read_json(tmp_path / "data/history/vale-do-taquari/plan.json") == plan


def test_validated_extension_cache_and_singleton(tmp_path, area):
    settings, snapshot = configure(tmp_path, area)
    calls = []

    def search(wkt, start, end, area_id, **kwargs):
        calls.append((start, end, area_id, kwargs))
        return [
            scene(scene_id="validated", start_time="2026-11-14T23:59:59Z", maturity="VALIDATED"),
            scene(scene_id="validated", start_time="2026-11-14T23:59:59Z", maturity="VALIDATED"),
        ]

    plan = plan_history(settings, snapshot, validated_through=date(2026, 11, 14), search_fn=search)
    assert len(plan["catalog"]["scenes"]) == 2 and not plan["pairs"]
    assert any(g["status"] == "no_pair" for g in plan["groups"])
    assert calls[0][0] == "2026-06-17T00:00:00Z"
    assert calls[0][1] == "2026-11-14T23:59:59.999999Z"
    assert calls[0][3]["short_name"] == "NISAR_L2_GCOV_V1"
    validated = plan["catalog"]["scenes"][-1]
    assert validated["metadata"]["collection"] == "NISAR_L2_GCOV_V1"
    assert plan["validated_query"]["accessed_at"]
    assert (
        plan_history(settings, snapshot, validated_through=date(2026, 11, 14), search_fn=search)
        == plan
    )
    assert len(calls) == 1


def test_failed_extension_preserves_previous_plan(tmp_path, area):
    settings, snapshot = configure(tmp_path, area)
    previous = plan_history(settings, snapshot)

    def unavailable(*args, **kwargs):
        raise ProviderError("ASF unavailable after 3 attempts")

    with pytest.raises(ProviderError):
        plan_history(
            settings, snapshot, validated_through=date(2026, 11, 14), search_fn=unavailable
        )
    assert read_json(tmp_path / "data/history/test/plan.json") == previous


def test_pair_groups_never_mix_maturity_release_geometry_or_same_acquisition():
    base = scene(maturity="PROVISIONAL")
    later = base.model_copy(
        update={"scene_id": "later", "start_time": base.start_time.replace(day=23)}
    )
    values = [base, later, base.model_copy(update={"scene_id": "same-acquisition"})]
    for key, value in [
        ("track", 103),
        ("frame", 163),
        ("release", "P05036"),
        ("maturity", "VALIDATED"),
        ("mode", None),
    ]:
        values.append(later.model_copy(update={"scene_id": key, key: value}))
    pairs, groups = candidate_pairs(values)
    assert len(pairs) == 1
    assert pairs[0]["after"] == "later"
    assert all(p["before"] != p["after"] for p in pairs)
    assert len(groups) == 6


def test_two_validated_scenes_form_one_pair_preserving_mandatory(tmp_path, area):
    settings, snapshot = configure(tmp_path, area)
    found = [
        scene(scene_id="v1", maturity="VALIDATED", release="V1"),
        scene(scene_id="v2", maturity="VALIDATED", release="V1", start_time="2026-07-23T21:33:50Z"),
    ]
    plan = plan_history(
        settings, snapshot, validated_through=date(2026, 11, 14), search_fn=lambda *a, **k: found
    )
    assert len(plan["catalog"]["scenes"]) == 3
    assert plan["pairs"] == [{"before": "v1", "after": "v2"}]


def test_snapshot_area_mismatch_and_incomplete_rejected(tmp_path, area):
    settings, snapshot = configure(tmp_path, area)
    value = read_json(snapshot)
    value["scenes"][0]["area_id"] = "other"
    write_json(snapshot, value)
    with pytest.raises(ValueError, match="area"):
        plan_history(settings, snapshot)


def test_history_cli_dry_run_has_totals_without_download(tmp_path, capfd):
    from surfacesignal.cli import main

    (tmp_path / "config/areas").mkdir(parents=True)
    (tmp_path / "config/areas/vale-do-taquari.geojson").write_bytes(
        (REPOSITORY / "config/areas/vale-do-taquari.geojson").read_bytes()
    )
    assert (
        main(["--root", str(tmp_path), "history", "run", "--snapshot", str(SNAPSHOT), "--dry-run"])
        == 0
    )
    import json

    result = json.loads(capfd.readouterr().out)
    assert result["scene_count"] == 19 and result["candidate_pairs"] == 17
    assert result["total_bytes"] == result["remaining_bytes"] == 131_386_572_800
    assert result["disk"] and result["expected_artifacts"]
    assert not list(tmp_path.rglob("*.h5"))


def test_download_batch_resume_retains_all_nineteen_receipts(tmp_path, area, gcov, monkeypatch):
    from test_asf import DownloadSession

    import surfacesignal.processing.history as history
    from surfacesignal.providers.asf import download

    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    settings, snapshot = configure(tmp_path, area)
    value = read_json(snapshot)
    value["scenes"] = [
        scene(
            scene_id=f"synthetic-{n}",
            maturity="PROVISIONAL",
            synthetic=True,
            size_bytes=gcov.stat().st_size,
        ).model_dump(mode="json")
        for n in range(19)
    ]
    write_json(snapshot, value)
    plan = plan_history(settings, snapshot)
    requested = []

    def interrupted(scene, directory, budget, **kwargs):
        if len(requested) == 5:
            raise KeyboardInterrupt
        requested.append(scene.scene_id)
        return download(scene, directory, budget, session=DownloadSession(gcov.read_bytes()))

    with pytest.raises(KeyboardInterrupt):
        history.download_history(settings, plan, download_fn=interrupted)
    assert len(list((tmp_path / "data/raw").glob("*.receipt.json"))) == 5

    def complete(scene, directory, budget, **kwargs):
        requested.append(scene.scene_id)
        return download(scene, directory, budget, session=DownloadSession(gcov.read_bytes()))

    result = history.download_history(settings, plan, download_fn=complete)
    assert result["downloads_complete"] and len(result["scenes"]) == 19
    assert len(requested) == len(set(requested)) == 19
    assert len(list((tmp_path / "data/raw").glob("*.receipt.json"))) == 19
    assert history.planning_summary(settings, plan)["remaining_bytes"] == 0


def test_batch_disk_preflight_blocks_all_network(tmp_path, area, monkeypatch):
    import surfacesignal.processing.history as history

    settings, snapshot = configure(tmp_path, area)
    plan = plan_history(settings, snapshot)
    monkeypatch.setattr(history.shutil, "disk_usage", lambda _: type("Usage", (), {"free": 1})())

    def forbidden(*args, **kwargs):
        raise AssertionError("disk guard reached network")

    result = history.download_history(settings, plan, download_fn=forbidden)
    assert not result["downloads_complete"]
    assert "disk" in result["error"].lower()


def test_unknown_size_and_unreceipted_files_preserved_for_review(tmp_path, area):
    import surfacesignal.processing.history as history

    settings, snapshot = configure(tmp_path, area)
    value = read_json(snapshot)
    unknown = scene(scene_id="unknown", maturity="PROVISIONAL").model_dump(mode="json")
    value["scenes"].append(unknown)
    write_json(snapshot, value)
    plan = plan_history(settings, snapshot)
    raw = tmp_path / "data/raw"
    raw.mkdir(parents=True)
    target = raw / (plan["mandatory_ids"][0] + ".h5")
    target.write_bytes(b"preserve this original")
    result = history.download_history(
        settings, plan, download_fn=lambda *a, **k: pytest.fail("unsafe redownload")
    )
    assert not result["downloads_complete"]
    assert {s["status"] for s in result["scenes"]} == {"needs_review", "unknown_size"}
    assert target.read_bytes() == b"preserve this original"


def test_history_lock_released_after_interruption(tmp_path):
    from surfacesignal.processing.history import history_lock

    settings = Settings(root=tmp_path)
    with pytest.raises(KeyboardInterrupt), history_lock(settings, "test"):
        with pytest.raises(ValueError, match="already running"):
            with history_lock(settings, "test"):
                pass
        raise KeyboardInterrupt
    with history_lock(settings, "test"):
        pass
