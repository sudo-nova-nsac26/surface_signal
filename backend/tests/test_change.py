import numpy as np
import pytest
from affine import Affine
from rasterio.crs import CRS

from surfacesignal.processing.change import agreement, compare, power_db
from surfacesignal.processing.gcov import Raster


def raster(data, transform=None, crs=32722):
    return Raster(
        np.array(data, dtype="float32"),
        transform or Affine(20, 0, 400000, 0, -20, 6750000),
        CRS.from_epsg(crs),
        {},
    )


def test_power_db_masks_invalid_and_uses_ten():
    out = power_db(np.array([1, 0.1, 0.01, 0, -1, np.nan]))
    np.testing.assert_allclose(out[:3], [0, -10, -20])
    assert np.isnan(out[3:]).all()


def test_change_and_candidate_area():
    r = compare(
        raster([[0.1, 0.1], [0.1, 0.1]]),
        raster([[0.001, 0.1], [0.2, np.nan]]),
        edge_pixels=0,
        min_component_pixels=1,
    )
    assert r["statistics"]["valid_pixels"] == 3
    assert r["statistics"]["candidate_pixels"] == 1
    assert r["statistics"]["candidate_area_km2"] == pytest.approx(0.0004)
    assert r["statistics"]["candidate_percent"] == pytest.approx(100 / 3)
    assert r["delta"][0, 0] == pytest.approx(-20)


def test_nonmetric_rejected_and_reprojection_recorded():
    with pytest.raises(ValueError, match="metre"):
        compare(raster([[1, 1], [1, 1]], crs=4326), raster([[1, 1], [1, 1]], crs=4326))
    a = raster(np.ones((4, 4)))
    b = raster(np.ones((4, 4)), Affine(20, 0, 400020, 0, -20, 6750000))
    result = compare(a, b, edge_pixels=0, min_component_pixels=1)
    assert result["alignment"]["resampled"] and result["statistics"]["valid_pixels"] == 12


def test_agreement_hand_computed_and_empty():
    r = agreement(np.array([1, 1, 0, 0], bool), np.array([1, 0, 1, 0], bool), np.ones(4, bool))
    assert r["precision"] == 0.5 and r["recall"] == 0.5 and r["iou"] == pytest.approx(1 / 3)
    assert r["f1"] == 0.5 and r["tp"] == 1
    e = agreement(np.zeros(4, bool), np.zeros(4, bool), np.ones(4, bool))
    assert e["precision"] is None and e["iou"] is None


def test_small_component_filter_and_false_negative_documented():
    before = raster(np.full((5, 5), 0.1))
    data = np.full((5, 5), 0.1)
    data[2, 2] = 0.001
    data[1, 1] = 1
    result = compare(before, raster(data), edge_pixels=0, min_component_pixels=2)
    assert result["statistics"]["candidate_pixels"] == 0
    assert result["statistics"]["decrease_pixels"] == 1
    # Stronger returns (possible vegetation/urban double bounce) are not water labels.
    assert not result["candidates"][1, 1]


def test_no_common_coverage_rejected():
    with pytest.raises(ValueError, match="common valid"):
        compare(
            raster(np.ones((4, 4))),
            raster(np.ones((4, 4)), Affine(20, 0, 500000, 0, -20, 6750000)),
            edge_pixels=0,
        )


def test_different_crs_is_aligned_to_metric_baseline():
    from rasterio.transform import array_bounds
    from rasterio.warp import Resampling, calculate_default_transform, reproject

    before = raster(np.ones((8, 8)))
    transform, w, h = calculate_default_transform(
        before.crs, CRS.from_epsg(4326), 8, 8, *array_bounds(8, 8, before.transform)
    )
    data = np.full((h, w), np.nan, dtype="float32")
    reproject(
        before.data,
        data,
        src_transform=before.transform,
        src_crs=before.crs,
        dst_transform=transform,
        dst_crs=CRS.from_epsg(4326),
        dst_nodata=np.nan,
        resampling=Resampling.nearest,
    )
    result = compare(before, Raster(data, transform, CRS.from_epsg(4326), {}), edge_pixels=1)
    assert result["alignment"]["resampled"] and result["statistics"][
        "mean_delta_db"
    ] == pytest.approx(0)
