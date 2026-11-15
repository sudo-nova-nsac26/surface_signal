import math

import httpx
import numpy as np
import pytest
import rasterio
from pyproj import Transformer
from rasterio.transform import from_origin
from shapely.geometry import box, mapping
from shapely.ops import transform

from surfacesignal.context.spatial import raster_summary, summarize_municipalities
from surfacesignal.context.validation import compare_reference
from surfacesignal.providers.context_discovery import discover


def raster(tmp_path, values, crs="EPSG:32722"):
    path = tmp_path / "synthetic.tif"
    affine = from_origin(400000, 6700000, 30, 30)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=values.shape[1],
        height=values.shape[0],
        count=1,
        dtype="float32",
        crs=crs,
        transform=affine,
        nodata=-9999,
    ) as dst:
        dst.write(values.astype("float32"), 1)
    geom = box(400000, 6700000 - 30 * values.shape[0], 400000 + 30 * values.shape[1], 6700000)
    geom = transform(Transformer.from_crs(crs, 4326, always_xy=True).transform, geom)
    return path, mapping(geom)


def test_mapbiomas_partial_nodata_and_explicit_year(tmp_path):
    path, geom = raster(tmp_path, np.array([[1, 0], [1, -9999]]))
    metadata = dict(
        reference_year=2025,
        dataset_version="5",
        asset_id="synthetic",
        band="annual",
        product_kind="annual",
        water_classes=[1],
    )
    result = raster_summary(path, geom, "mapbiomas-water", metadata)
    assert result["status"] == "partial"
    assert result["coverage_fraction"] == pytest.approx(0.75, abs=0.001)
    assert result["overlap_fraction"] == pytest.approx(2 / 3, abs=0.001)
    assert result["reference_year"] == 2025
    with pytest.raises(ValueError, match="year"):
        raster_summary(path, geom, "mapbiomas-water", {**metadata, "reference_year": 2026})
    with pytest.raises(ValueError, match="budget"):
        raster_summary(path, geom, "mapbiomas-water", metadata, max_pixels=1)


def test_worldcover_classes_and_no_coverage(tmp_path):
    path, geom = raster(tmp_path, np.array([[10, 40], [80, 255]]))
    meta = dict(reference_year=2021, dataset_version="v200")
    result = raster_summary(path, geom, "worldcover", meta)
    classes = {v["class_id"]: v["percent"] for v in result["classes"]}
    assert classes["unknown"] == pytest.approx(25, abs=0.01)
    assert classes["water"] == pytest.approx(25, abs=0.01)
    result = raster_summary(path, mapping(box(1, 1, 2, 2)), "worldcover", meta)
    assert result["status"] == "unavailable"
    assert result["valid_area_km2"] is None


def test_dsm_metric_slope_and_nodata(tmp_path):
    values = np.tile(np.arange(10) * 3.0, (10, 1))
    path, geom = raster(tmp_path, values)
    result = raster_summary(
        path, geom, "copernicus-dem", dict(native_unit="m", vertical_datum="synthetic")
    )
    assert result["surface_model"] == "DSM"
    assert result["slope_deg"] == pytest.approx(math.degrees(math.atan(0.1)), abs=0.05)
    assert result["elevation_m"] == pytest.approx(13.5, abs=0.01)


def test_frequency_is_not_contemporary_water_mask(tmp_path):
    path, geom = raster(tmp_path, np.array([[0, 50], [100, 50]]))
    result = raster_summary(
        path,
        geom,
        "mapbiomas-water",
        dict(
            reference_year=2025,
            dataset_version="5",
            asset_id="synthetic",
            band="frequency",
            product_kind="frequency",
            frequency_scale=100,
        ),
    )
    assert result["mean_frequency"] == pytest.approx(0.5, abs=0.001)
    assert result["overlap_km2"] is None


def test_ibge_verified_code_and_positive_intersection():
    geom = mapping(box(-52, -30, -51, -29))
    collection = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {"CD_MUN": "4311403", "NM_MUN": "Synthetic municipality"},
            }
        ],
    }
    result = summarize_municipalities(collection, geom)
    assert result["municipalities_intersecting_candidate"][0]["municipality_code"] == "4311403"
    collection["features"][0]["properties"]["CD_MUN"] = "unknown"
    with pytest.raises(ValueError):
        summarize_municipalities(collection, geom)


def test_validation_gates_and_metrics():
    geom = mapping(box(-52, -30, -51, -29))
    args = dict(
        observed_at="2026-07-23T21:00:00Z",
        reference_at="2026-07-23T20:00:00Z",
        tolerance_hours=2,
        independent=True,
        quality_verified=True,
        reference_id="synthetic",
    )
    result = compare_reference(geom, geom, geom, geom, **args)
    assert result["metrics"]["iou"] == pytest.approx(1)
    partial = mapping(box(-52, -30, -51.5, -29))
    assert compare_reference(geom, geom, geom, partial, **args)["metrics"] is None
    assert (
        compare_reference(geom, geom, geom, geom, **{**args, "independent": False})["metrics"]
        is None
    )
    assert (
        compare_reference(geom, geom, geom, geom, **{**args, "tolerance_hours": 0.5})["metrics"]
        is None
    )


def test_discovery_empty_bounded_and_restricted():
    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"features": [], "links": []})
        )
    )
    args = ([-52, -30, -51, -29], "2026-07-01T00:00:00Z", "2026-07-30T00:00:00Z")
    result = discover("sentinel-2", *args, client=client)
    assert result["status"] == "unavailable" and result["complete"]
    assert len(result["source_sha256"]) == 64
    assert discover("rcm", *args)["status"] == "blocked"
    with pytest.raises(ValueError, match="budget"):
        discover("sentinel-2", *args, client=client, max_bytes=1)


def test_cems_activations_do_not_establish_spatial_validation():
    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={
                    "results": [{"code": "SYNTHETIC", "activationTime": "2026-07-23T12:00:00"}],
                    "next": None,
                },
            )
        )
    )
    result = discover(
        "copernicus-ems",
        [-52, -30, -51, -29],
        "2026-07-01T00:00:00Z",
        "2026-07-30T00:00:00Z",
        client=client,
    )
    assert result["status"] == "partial"
    assert result["items"][0]["spatial_coverage"] == "not_checked"
    assert result["items"][0]["observed_at"].endswith("+00:00")


def test_missing_datum_crs_mismatch_and_no_valid_pixels(tmp_path):
    path, geom = raster(tmp_path, np.full((3, 3), -9999))
    with pytest.raises(ValueError, match="datum"):
        raster_summary(path, geom, "copernicus-dem", dict(native_unit="m"))
    with pytest.raises(ValueError, match="CRS"):
        raster_summary(
            path,
            geom,
            "copernicus-dem",
            dict(native_unit="m", vertical_datum="synthetic", crs="EPSG:4326"),
        )
    result = raster_summary(
        path, geom, "copernicus-dem", dict(native_unit="m", vertical_datum="synthetic")
    )
    assert result["status"] == "unavailable"
    assert "elevation_m" not in result


def test_raster_clip_fractional_pixel_footprint(tmp_path):
    path, _ = raster(tmp_path, np.array([[80, 10], [80, 10]]))
    # Half of water column and full tree column: 1/3 water area, not half.
    geom = transform(
        Transformer.from_crs(32722, 4326, always_xy=True).transform,
        box(400015, 6699940, 400060, 6700000),
    )
    result = raster_summary(
        path, mapping(geom), "worldcover", dict(reference_year=2021, dataset_version="v200")
    )
    water = next(c for c in result["classes"] if c["class_id"] == "water")
    assert water["percent"] == pytest.approx(100 / 3, abs=0.01)
