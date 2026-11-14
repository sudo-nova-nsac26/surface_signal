import h5py
import numpy as np
import pytest
from conftest import make_gcov
from test_domain import scene

from surfacesignal.processing.gcov import crop, inspect_gcov, verify_scene


def test_inspection_and_crop_shape_transform(gcov, area):
    report = inspect_gcov(gcov)
    assert report["synthetic"] and report["datasets"]["/science/LSAR/GCOV/grids/frequencyA/HHHH"][
        "shape"
    ] == [4, 4]
    r = crop(gcov, area)
    assert r.data.shape == (4, 4) and r.transform.a == 20 and r.transform.e == -20
    assert r.transform.c == 400000 and r.transform.f == 6750000
    assert r.crs.to_epsg() == 32722 and np.isfinite(r.data).all()


def test_rejects_complex_missing_channel_and_memory(gcov, area):
    for channel in ["HHHV", "VVVV"]:
        with pytest.raises(ValueError):
            crop(gcov, area, channel=channel)
    with pytest.raises(ValueError, match="pixel budget"):
        crop(gcov, area.model_copy(update={"max_pixels": 1}))


def test_axis_reversal_preserves_geography(tmp_path, area):
    data = np.arange(1, 17, dtype="float32").reshape(4, 4)
    a = make_gcov(tmp_path / "a.h5", data)
    b = make_gcov(
        tmp_path / "b.h5",
        data[::-1, ::-1],
        x=np.arange(4)[::-1] * 20 + 400010,
        y=(6749990 - np.arange(4) * 20)[::-1],
    )
    assert np.array_equal(crop(a, area).data, crop(b, area).data)


def test_invalid_values_quality_and_no_overlap(gcov, area):
    with h5py.File(gcov, "r+") as h:
        g = h["/science/LSAR/GCOV/grids/frequencyA"]
        g["HHHH"][0, :] = [0, -1, np.nan, -9999]
        g["numberOfLooks"][1, 0] = 0
        g["mask"][1, 1] = 255
    r = crop(gcov, area)
    assert np.isnan(r.data).sum() == 6
    away = area.model_copy(
        update={
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1], [0, 0]]],
            }
        }
    )
    with pytest.raises(ValueError, match="overlap"):
        crop(gcov, away)


def test_identity_cannot_present_synthetic_as_real(gcov):
    with pytest.raises(ValueError, match="synthetic"):
        verify_scene(gcov, scene())
    verify_scene(gcov, scene(synthetic=True))
    with pytest.raises(ValueError, match="track"):
        verify_scene(gcov, scene(synthetic=True, track=99))


def test_nisar_utc_timestamp_without_timezone_is_supported(tmp_path):
    path = make_gcov(tmp_path / "synthetic.h5", time="2026-07-11T21:33:51.000000000")
    verify_scene(path, scene(synthetic=True))


def test_inspection_serializes_hdf5_dimension_references(gcov):
    import json

    with h5py.File(gcov, "r+") as h:
        group = h["/science/LSAR/GCOV/grids/frequencyA"]
        group["xCoordinates"].make_scale("x")
        group["yCoordinates"].make_scale("y")
        group["HHHH"].dims[0].attach_scale(group["yCoordinates"])
        group["HHHH"].dims[1].attach_scale(group["xCoordinates"])
    report = inspect_gcov(gcov)
    payload = json.dumps(report, sort_keys=True, allow_nan=False)
    attrs = report["datasets"]["/science/LSAR/GCOV/grids/frequencyA/HHHH"]["attrs"]
    assert "/science/LSAR/GCOV/grids/frequencyA/xCoordinates" in str(attrs["DIMENSION_LIST"])
    assert "REFERENCE_LIST" in payload


def test_documented_invalid_contributor_mask_excluded(gcov, area):
    with h5py.File(gcov, "r+") as h:
        mask = h["/science/LSAR/GCOV/grids/frequencyA/mask"]
        mask[:] = 11
        mask[0, 0] = 0
        mask[0, 1] = 255
    r = crop(gcov, area)
    assert np.isnan(r.data).sum() == 2
    assert "mask invalid contributors (0) excluded" in r.metadata["quality_filters"]
