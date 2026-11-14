from pathlib import Path

import h5py
import numpy as np
import pytest
from pyproj import Transformer
from shapely import transform
from shapely.geometry import box, mapping

from surfacesignal.domain import AreaConfig


def make_gcov(path, data=None, x=None, y=None, epsg=32722, time="2026-07-11T21:33:51Z"):
    data = (
        np.full((4, 4), 0.1, dtype="float32") if data is None else np.asarray(data, dtype="float32")
    )
    with h5py.File(path, "w") as h:
        h.attrs["synthetic"] = True
        g = h.create_group("/science/LSAR/GCOV/grids/frequencyA")
        d = g.create_dataset("HHHH", data=data)
        d.attrs["_FillValue"] = -9999.0
        g.create_dataset("HHHV", data=np.ones(data.shape, dtype="complex64"))
        g.create_dataset(
            "xCoordinates", data=np.arange(data.shape[1]) * 20 + 400010 if x is None else x
        )
        g.create_dataset(
            "yCoordinates", data=6749990 - np.arange(data.shape[0]) * 20 if y is None else y
        )
        g.create_dataset("projection", data=epsg)
        g.create_dataset("numberOfLooks", data=np.ones(data.shape) * 4)
        m = g.create_dataset("mask", data=np.full(data.shape, 11, dtype="uint8"))
        m.attrs["_FillValue"] = 255
        i = h.create_group("/science/LSAR/identification")
        for k, v in {
            "trackNumber": 53,
            "frameNumber": 103,
            "orbitPassDirection": "Descending",
            "zeroDopplerStartTime": time,
            "productType": "GCOV",
        }.items():
            i.create_dataset(k, data=v)
    return Path(path)


@pytest.fixture
def gcov(tmp_path):
    return make_gcov(tmp_path / "synthetic-before.h5")


@pytest.fixture
def area():
    t = Transformer.from_crs(32722, 4326, always_xy=True)
    geom = transform(box(400000, 6749920, 400080, 6750000), t.transform, interleaved=False)
    return AreaConfig(
        area_id="test",
        name="Synthetic test AOI",
        geometry=mapping(geom),
        source_url="https://example.org/synthetic",
    )
