# ruff: noqa: F811
from datetime import UTC, datetime, timedelta

import pytest
from test_pipeline_api import client_for, prepared  # noqa: F401

from surfacesignal.config import Settings
from surfacesignal.context.importer import import_dataset
from surfacesignal.context.models import ContextBudgets
from surfacesignal.context.store import ContextInvalid, build_context, load_context
from surfacesignal.context.temporal import accumulate_rainfall
from surfacesignal.storage import checksum, read_json, write_json


def inputs(root, *, source="ana-hidroweb", restricted=False):
    file = root / "measurements.json"
    row = {
        "station_id": "synthetic-station",
        "station_name": "Illustrative station",
        "observed_at": "2026-07-23T18:33:50-03:00",
        "parameter": "river_level",
        "value": 120,
        "unit": "cm",
        "quality_status": "valid",
        "method": "synthetic fixture",
        "datum": "synthetic gauge zero",
        "longitude": 0,
        "latitude": 0,
    }
    write_json(
        file,
        {
            "records": [
                row,
                row,
                {
                    **row,
                    "observed_at": "2026-07-23T17:33:50-03:00",
                    "value": None,
                    "quality_status": "missing",
                },
            ]
        },
    )
    metadata = root / "metadata.json"
    write_json(
        metadata,
        {
            "source_id": source,
            "provider": "Synthetic fixture",
            "dataset_id": "synthetic-test",
            "dataset_version": "1",
            "retrieved_at": "2026-11-15T00:00:00Z",
            "observed_start": "2026-07-23T00:00:00Z",
            "observed_end": "2026-07-24T00:00:00Z",
            "source_url": "https://example.org/synthetic",
            "source_sha256": checksum(file),
            "crs": "EPSG:4326",
            "native_unit": "cm",
            "normalized_unit": "m",
            "license_id": "synthetic-test-only",
            "redistribution_allowed": not restricted,
            "synthetic": True,
        },
    )
    return file, metadata


def test_hydro_import_build_api_idempotence_and_preservation(prepared):
    analysis, args, root = prepared
    client = client_for(root, args[-1])
    settings = Settings(root=root)
    before = {p.name: checksum(p) for p in (root / "artifacts" / analysis.analysis_id).iterdir()}
    file, meta = inputs(root)
    imported = import_dataset(settings, "test", "ana-hidroweb", file, meta)
    assert imported == import_dataset(settings, "test", "ana-hidroweb", file, meta)
    built = build_context(settings, analysis.analysis_id)
    assert build_context(settings, analysis.analysis_id) == built
    report = load_context(settings, analysis.analysis_id)["payloads"]["environmental-context.json"]
    assert report["synthetic"] and report["data_status"] == "partial"
    assert len(report["hydrology"]["records"]) == 2
    record = report["hydrology"]["records"][1]
    assert record["value"] == 1.2 and record["unit"] == "m"
    assert record["longitude"] == 0 and record["time_offset_hours"] == 0
    assert record["observed_at"] == "2026-07-23T21:33:50Z"
    assert report["rainfall"]["windows_mm"]["24h"] is None
    assert report["validation"]["metrics"] is None
    assert (
        client.get(f"/api/v1/analyses/{analysis.analysis_id}/environmental-context").json()
        == report
    )
    events = client.get(
        "/api/v1/areas/test/environmental-events?start=2026-07-23&end=2026-07-23&limit=1"
    ).json()
    assert events["total"] == 2 and len(events["items"]) == 1
    assert (
        client.get(
            "/api/v1/areas/test/environmental-events?start=2026-07-24&end=2026-07-23"
        ).status_code
        == 422
    )
    assert before == {
        p.name: checksum(p) for p in (root / "artifacts" / analysis.analysis_id).iterdir()
    }


def test_unprepared_corrupt_and_restricted(prepared):
    analysis, args, root = prepared
    client = client_for(root, args[-1])
    settings = Settings(root=root)
    url = f"/api/v1/analyses/{analysis.analysis_id}/environmental-context"
    assert client.get(url).status_code == 404
    assert client.get(url).json()["error"]["code"] == "context_not_prepared"
    file, meta = inputs(root, restricted=True)
    import_dataset(settings, "test", "ana-hidroweb", file, meta)
    built = build_context(settings, analysis.analysis_id)
    report = client.get(url).json()
    assert report["data_status"] == "unavailable" and report["sources"] == []
    path = (
        root / "data/context/test" / analysis.analysis_id / built["context_id"] / "validation.json"
    )
    path.unlink()
    assert client.get(url).status_code == 503
    with pytest.raises(ContextInvalid):
        load_context(settings, analysis.analysis_id)


def test_budgets_and_dry_run_do_not_publish(prepared):
    analysis, args, root = prepared
    client_for(root, args[-1])
    settings = Settings(root=root)
    file, meta = inputs(root)
    import_dataset(settings, "test", "ana-hidroweb", file, meta, dry_run=True)
    assert not (root / "data/context").exists()
    build_context(settings, analysis.analysis_id, dry_run=True)
    assert not (root / "data/context").exists()
    with pytest.raises(ValueError, match="budget"):
        import_dataset(
            settings, "test", "ana-hidroweb", file, meta, budgets=ContextBudgets(max_input_bytes=1)
        )
    with pytest.raises(ValueError, match="budget"):
        build_context(settings, analysis.analysis_id, budgets=ContextBudgets(max_output_bytes=1))
    assert not (root / "data/context/test" / analysis.analysis_id / "current.json").exists()


def test_rainfall_units_boundaries_coverage_and_zero():
    end = datetime(2026, 7, 23, 21, 33, 50, tzinfo=UTC)
    rows = [
        {
            "start": end - timedelta(hours=i + 0.5),
            "end": end - timedelta(hours=i),
            "value": 2,
            "unit": "mm/h",
            "quality_status": "valid",
        }
        for i in [x * 0.5 for x in range(144)]
    ]
    result = accumulate_rainfall(rows, end)
    assert result["windows_mm"] == {"24h": 48, "48h": 96, "72h": 144}
    rows[0]["value"] = None
    assert accumulate_rainfall(rows, end)["windows_mm"]["24h"] is None
    assert accumulate_rainfall(rows, end, minimum_coverage=0.95)["windows_mm"]["24h"] == 47
    assert (
        accumulate_rainfall(
            [
                {
                    "start": end - timedelta(hours=24),
                    "end": end,
                    "value": 0,
                    "unit": "mm",
                    "quality_status": "valid",
                }
            ],
            end,
        )["windows_mm"]["24h"]
        == 0
    )
    # Cannot apportion interval totals crossing the observation instant.
    assert (
        accumulate_rainfall(
            [
                {
                    "start": end - timedelta(hours=24),
                    "end": end + timedelta(hours=1),
                    "value": 25,
                    "unit": "mm",
                    "quality_status": "valid",
                }
            ],
            end,
        )["windows_mm"]["24h"]
        is None
    )
    with pytest.raises(ValueError, match="Overlapping"):
        accumulate_rainfall([rows[0], rows[0]], end)


def test_conflicts_timezone_and_secret_metadata_rejected(prepared):
    _, args, root = prepared
    client_for(root, args[-1])
    settings = Settings(root=root)
    file, meta = inputs(root, source="sgb-taquari")
    values = read_json(meta)
    values["source_url"] = "https://example.org/data?token=secret"
    write_json(meta, values)
    with pytest.raises(ValueError):
        import_dataset(settings, "test", "sgb-taquari", file, meta)
    file, meta = inputs(root, source="sgb-taquari")
    value = read_json(file)
    value["records"][1]["value"] = 999
    write_json(file, value)
    metadata = read_json(meta)
    metadata["source_sha256"] = checksum(file)
    write_json(meta, metadata)
    with pytest.raises(ValueError, match="duplicate"):
        import_dataset(settings, "test", "sgb-taquari", file, meta)


def test_qualified_reference_is_used_only_with_verified_shared_coverage(prepared):
    analysis, args, root = prepared
    client_for(root, args[-1])
    settings = Settings(root=root)
    file, meta = inputs(root)
    metadata = read_json(meta)
    file = root / "reference.json"
    write_json(
        file,
        {
            "reference_geometry": args[-1].geometry,
            "valid_coverage": args[-1].geometry,
            "reference_at": analysis.scenes[1].start_time.isoformat(),
            "independent": True,
            "quality_verified": True,
            "method": "synthetic independently mapped water fixture",
            "class_mapping": {"water": 1},
        },
    )
    metadata.update(
        source_id="copernicus-ems",
        source_sha256=checksum(file),
        native_unit="class",
        normalized_unit="class",
        parameters={"tolerance_hours": 1},
    )
    write_json(meta, metadata)
    import_dataset(settings, "test", "copernicus-ems", file, meta)
    build_context(settings, analysis.analysis_id)
    result = load_context(settings, analysis.analysis_id)["payloads"]["validation.json"]
    assert result["status"] == "validated_against_reference"
    assert result["metrics"]["precision"] == pytest.approx(1)
    assert result["coverage"]["shared_valid_km2"] > 0
    assert result["reference"]["method"].startswith("synthetic")
    value = read_json(file)
    value["independent"] = False
    write_json(file, value)
    metadata["source_sha256"] = checksum(file)
    write_json(meta, metadata)
    import_dataset(settings, "test", "copernicus-ems", file, meta)
    build_context(settings, analysis.analysis_id)
    assert (
        load_context(settings, analysis.analysis_id)["payloads"]["validation.json"]["metrics"]
        is None
    )


def test_imerg_import_preserves_run_and_each_acquisition(prepared):
    analysis, args, root = prepared
    client_for(root, args[-1])
    settings = Settings(root=root)
    file, meta = inputs(root)
    end = analysis.scenes[1].start_time
    write_json(
        file,
        {
            "records": [
                {
                    "start": (end - timedelta(hours=72)).isoformat(),
                    "end": end.isoformat(),
                    "value": 0,
                    "unit": "mm/h",
                    "quality_status": "valid",
                }
            ]
        },
    )
    value = read_json(meta)
    value.update(
        source_id="gpm-imerg",
        dataset_version="07B",
        source_sha256=checksum(file),
        observed_start=(end - timedelta(hours=72)).isoformat(),
        observed_end=end.isoformat(),
        native_unit="mm/h",
        normalized_unit="mm",
        spatial_resolution_m=10000,
        parameters={"run": "final", "spatial_support": "synthetic AOI mean"},
    )
    write_json(meta, value)
    import_dataset(settings, "test", "gpm-imerg", file, meta)
    build_context(settings, analysis.analysis_id)
    rain = load_context(settings, analysis.analysis_id)["payloads"]["environmental-context.json"][
        "rainfall"
    ]
    assert rain["windows_mm"] == {"24h": 0, "48h": 0, "72h": 0}
    assert rain["acquisitions"]["before"]["windows_mm"]["24h"] is None
    assert rain["run"] == "final" and rain["resolution_km_approx"] == 10


def test_dataset_parameters_cannot_override_canonical_provenance(prepared):
    from surfacesignal.context.models import ContextDataset

    _, args, root = prepared
    client_for(root, args[-1])
    _, meta = inputs(root)
    value = read_json(meta)
    value.update(native_unit="ft", parameters={"native_unit": "m"})
    with pytest.raises(ValueError, match="override"):
        ContextDataset.model_validate(value)


def test_station_measurement_identity_is_independent_of_sar_acquisition(prepared):
    from surfacesignal.context.engine import assemble

    analysis, args, root = prepared
    client_for(root, args[-1])
    settings = Settings(root=root)
    file, meta = inputs(root)
    import_dataset(settings, "test", "ana-hidroweb", file, meta)
    _, first = assemble(settings, analysis, args[-1], ContextBudgets())
    other = analysis.model_copy(deep=True)
    other.scenes[1].start_time += timedelta(hours=1)
    _, second = assemble(settings, other, args[-1], ContextBudgets())
    assert first["environmental-events.json"] == second["environmental-events.json"]
    assert first["environmental-events.json"]["items"][0]["analysis_id"] is None
    assert (
        first["environmental-context.json"]["hydrology"]["records"][0]["time_offset_hours"]
        != second["environmental-context.json"]["hydrology"]["records"][0]["time_offset_hours"]
    )
