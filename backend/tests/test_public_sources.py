"""Offline fixtures only: strict byte ranges, provenance and honest daily labels."""

import hashlib
from datetime import UTC, datetime, timedelta

import httpx
import numpy as np
import pytest
from rasterio.io import MemoryFile
from rasterio.transform import from_origin

from surfacesignal.context.models import RainfallContext
from surfacesignal.context.temporal import summarize_daily_labels
from surfacesignal.providers.public_http import DownloadBudget, PublicRangeReader
from surfacesignal.providers.public_sources import _crop, _tile_urls

URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/test.tif"


def transport_for(raw, *, ignore=False, change=False):
    requests = []

    def handle(request):
        requests.append(request)
        start, end = map(int, request.headers["Range"].removeprefix("bytes=").split("-"))
        end = min(end, len(raw) - 1)
        if ignore:
            return httpx.Response(200, content=raw)
        return httpx.Response(
            206,
            content=raw[start : end + 1],
            headers={
                "Content-Range": f"bytes {start}-{end}/{len(raw)}",
                "ETag": '"changed"' if change and len(requests) > 1 else '"pinned"',
            },
        )

    return httpx.MockTransport(handle), requests


def raster_bytes():
    with MemoryFile() as memory:
        with memory.open(
            driver="GTiff",
            width=40,
            height=40,
            count=1,
            dtype="uint8",
            crs="EPSG:4326",
            transform=from_origin(-53, -29, 0.05, 0.05),
            nodata=0,
        ) as dst:
            dst.write(np.full((40, 40), 80, dtype="uint8"), 1)
        return memory.read()


def test_range_reader_hashes_bytes_and_pins_etag():
    raw = bytes(range(256)) * 1000
    transport, requests = transport_for(raw)
    budget = DownloadBudget(200_000)
    with httpx.Client(transport=transport) as client:
        reader = PublicRangeReader(client, URL, budget)
        reader.seek(70_000)
        assert reader.read(10) == raw[70_000:70_010]
        assert requests[1].headers["If-Match"] == '"pinned"'
        assert budget.used == 8192 + 65536
        evidence = reader.evidence()
        assert evidence["acquired_ranges"][0]["sha256"] == hashlib.sha256(raw[:8192]).hexdigest()


def test_budget_rejects_before_network_or_decode():
    raw = raster_bytes()
    transport, requests = transport_for(raw)
    with httpx.Client(transport=transport) as client:
        with pytest.raises(ValueError, match="budget"):
            PublicRangeReader(client, URL, DownloadBudget(100))
        assert not requests
        geometry = {
            "type": "Polygon",
            "coordinates": [
                [[-52.5, -29.5], [-52, -29.5], [-52, -30], [-52.5, -30], [-52.5, -29.5]]
            ],
        }
        with pytest.raises(ValueError, match="pixel budget"):
            _crop(URL, geometry, client, DownloadBudget(100_000), 10, source="worldcover")


def test_servers_must_honor_ranges_and_source_consistency():
    for ignore, change in [(True, False), (False, True)]:
        transport, _ = transport_for(b"x" * 100_000, ignore=ignore, change=change)
        with httpx.Client(transport=transport) as client:
            if ignore:
                with pytest.raises(ValueError, match="honor"):
                    PublicRangeReader(client, URL, DownloadBudget(200_000))
            else:
                reader = PublicRangeReader(client, URL, DownloadBudget(200_000))
                with pytest.raises(ValueError, match="ETag"):
                    reader.read(100)


def test_native_crop_uses_metered_opener():
    transport, _ = transport_for(raster_bytes())
    geometry = {
        "type": "Polygon",
        "coordinates": [[[-52.5, -29.5], [-52, -29.5], [-52, -30], [-52.5, -30], [-52.5, -29.5]]],
    }
    with httpx.Client(transport=transport) as client:
        data, profile, evidence = _crop(
            URL, geometry, client, DownloadBudget(100_000), 1000, source="worldcover"
        )
    assert data.shape == (10, 10)
    assert (data == 80).all()
    assert profile["nodata"] == 0
    assert len(evidence["acquired_ranges"]) >= 2


def test_prior_daily_labels_leave_acquisition_windows_null():
    observed = datetime(2026, 7, 23, 21, 33, 50, tzinfo=UTC)
    records = []
    for day, value in [(20, 0), (21, 2), (22, 3)]:
        start = datetime(2026, 7, day, tzinfo=UTC)
        records.append(
            {
                "start": start,
                "end": start + timedelta(days=1),
                "value": value,
                "unit": "mm",
                "quality_status": "valid",
            }
        )
    summary = summarize_daily_labels(records, observed)
    assert summary["totals_mm"] == {"1d": 3, "2d": 5, "3d": 5}
    assert "00:00:00" in summary["end_label_exclusive"]
    report = RainfallContext(source_id="chirps-v3", daily_summaries={"after": summary})
    assert report.windows_mm == {"24h": None, "48h": None, "72h": None}
    missing = summarize_daily_labels(records[1:], observed)
    assert missing["totals_mm"]["3d"] is None
    assert missing["coverage_by_days"]["3d"] == 2 / 3


def test_tile_selection_uses_actual_aoi_and_current_gsw_version():
    bounds = (-52.0126, -29.5122, -51.9094, -29.4218)
    assert len(_tile_urls("copernicus-dem", bounds)) == 2
    assert "S30W054" in _tile_urls("worldcover", bounds)[0]
    assert "occurrence_60W_20S_v1_5_2024.tif" in _tile_urls("jrc-gsw", bounds)[0]


def test_provider_failure_does_not_block_next_source(tmp_path, monkeypatch):
    from types import SimpleNamespace

    from surfacesignal.providers import public_sources

    area = SimpleNamespace(
        geometry={
            "type": "Polygon",
            "coordinates": [
                [
                    [-52.0126, -29.5122],
                    [-51.9094, -29.5122],
                    [-51.9094, -29.4218],
                    [-52.0126, -29.4218],
                    [-52.0126, -29.5122],
                ]
            ],
        }
    )
    instant = datetime(2026, 7, 23, tzinfo=UTC)
    monkeypatch.setattr(
        public_sources,
        "_request",
        lambda *args: (area, ["jrc-gsw", "worldcover"], instant, instant, []),
    )
    raw = raster_bytes()

    def handle(request):
        if request.url.host == "s3.waw4-1.cloudferro.com":
            return httpx.Response(404)
        return httpx.Response(
            206,
            content=raw,
            headers={"Content-Range": f"bytes 0-{len(raw) - 1}/{len(raw)}", "ETag": '"fixture"'},
        )

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        report = public_sources.check_public_sources(
            SimpleNamespace(root=tmp_path), "test", client=client, max_download_bytes=100_000
        )
    assert [item["status"] for item in report["sources"]] == ["unavailable", "accessible"]
    assert report["downloaded_bytes"] == len(raw)
    assert not (tmp_path / "data").exists()


def test_jrc_occurrence_keeps_zero_and_unknown_separate(tmp_path):
    import rasterio

    from surfacesignal.context.spatial import raster_summary

    file = tmp_path / "historical.tif"
    with rasterio.open(
        file,
        "w",
        driver="GTiff",
        width=3,
        height=1,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_origin(-52, -29, 0.01, 0.01),
        nodata=255,
    ) as dst:
        dst.write(np.array([[0, 100, 255]], dtype="uint8"), 1)
    geom = {
        "type": "Polygon",
        "coordinates": [[[-52, -29], [-51.97, -29], [-51.97, -29.01], [-52, -29.01], [-52, -29]]],
    }
    metadata = {
        "dataset_version": "1.5",
        "reference_year": 2024,
        "product_kind": "occurrence",
        "frequency_scale": 100,
    }
    result = raster_summary(file, geom, "jrc-gsw", metadata)
    assert result["status"] == "partial"
    assert result["mean_frequency"] == pytest.approx(0.5, abs=1e-5)
    assert result["overlap_km2"] is None
    assert result["coverage_fraction"] == pytest.approx(2 / 3, abs=1e-4)


def test_public_check_dates_use_versioned_catalog_on_clean_clone(tmp_path):
    import json

    from surfacesignal.config import Settings
    from surfacesignal.providers.public_sources import _request
    from surfacesignal.storage import write_json

    root = Settings().root
    area = json.loads((root / "config/areas/vale-do-taquari.geojson").read_text())
    catalog = json.loads((root / "docs/evidence/asf-catalog.json").read_text())
    write_json(tmp_path / "config/areas/vale-do-taquari.geojson", area)
    write_json(tmp_path / "docs/evidence/asf-catalog.json", catalog)
    _, ids, start, end, days = _request(
        Settings(root=tmp_path), "vale-do-taquari", None, None, None, 2_000_000
    )
    assert len(ids) == 5 and len(days) == 57
    assert start.year == 2026 and end.year == 2026
    assert not (tmp_path / "data").exists()
