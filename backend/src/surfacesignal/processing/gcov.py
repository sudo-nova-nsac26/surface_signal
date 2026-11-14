from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import h5py
import numpy as np
from affine import Affine
from pyproj import Transformer
from rasterio.crs import CRS
from rasterio.features import geometry_mask
from shapely import transform
from shapely.geometry import mapping, shape

from surfacesignal.domain import AreaConfig, Scene

DIAGONALS = {"HHHH", "HVHV", "VVVV", "VHVH", "RHRH", "RVRV"}
ROOT = "/science/LSAR/GCOV/grids"
IDENT = "/science/LSAR/identification"


@dataclass
class Raster:
    data: np.ndarray
    transform: Affine
    crs: CRS
    metadata: dict


def scalar(value, file=None):
    if isinstance(value, h5py.Reference):
        return file[value].name if value and file is not None else None
    if isinstance(value, bytes):
        return value.decode("utf-8")
    if isinstance(value, np.ndarray):
        return scalar(value.tolist(), file)
    if isinstance(value, np.generic):
        return scalar(value.item(), file)
    if isinstance(value, (tuple, list)):
        return [scalar(v, file) for v in value]
    if isinstance(value, complex):
        return {"real": scalar(value.real), "imag": scalar(value.imag)}
    if isinstance(value, float) and not np.isfinite(value):
        return str(value)
    return value


def inspect_gcov(path: Path) -> dict:
    report = {"file_name": path.name, "size_bytes": path.stat().st_size, "datasets": {}}
    with h5py.File(path, "r") as file:
        report["synthetic"] = bool(file.attrs.get("synthetic", False))

        def visit(name, obj):
            if isinstance(obj, h5py.Dataset):
                report["datasets"]["/" + name] = {
                    "shape": list(obj.shape),
                    "dtype": str(obj.dtype),
                    "dtype_kind": obj.dtype.kind,
                    "attrs": {k: scalar(v, file) for k, v in obj.attrs.items()},
                }
                if obj.size <= 4:
                    report["datasets"]["/" + name]["value"] = scalar(obj[()], file)

        file.visititems(visit)
    return report


def verify_scene(path: Path, scene: Scene) -> None:
    with h5py.File(path, "r") as file:
        synthetic = bool(file.attrs.get("synthetic", False))
        if synthetic != scene.synthetic:
            raise ValueError("File/catalog synthetic flags disagree")
        if not synthetic and path.stem != scene.scene_id:
            raise ValueError("GCOV filename does not match catalog scene ID")
        for key, expected in [
            ("trackNumber", scene.track),
            ("frameNumber", scene.frame),
            ("orbitPassDirection", scene.direction),
            ("productType", "GCOV"),
        ]:
            actual = scalar(file[f"{IDENT}/{key}"][()])
            if str(actual).upper() != str(expected).upper():
                raise ValueError(f"GCOV {key} differs from catalog")
        actual_time = datetime.fromisoformat(
            scalar(file[f"{IDENT}/zeroDopplerStartTime"][()]).replace("Z", "+00:00")
        )
        # NISAR product specification defines this field as UTC even without a suffix.
        if actual_time.tzinfo is None:
            actual_time = actual_time.replace(tzinfo=UTC)
        if abs((actual_time - scene.start_time).total_seconds()) > 1:
            raise ValueError("GCOV acquisition time differs from catalog")


def crop(path: Path, area: AreaConfig, *, frequency="A", channel="HHHH", min_looks=1.0) -> Raster:
    if channel not in DIAGONALS or frequency not in ("A", "B"):
        raise ValueError("Only real diagonal channels in frequency A/B are supported")
    if not np.isfinite(min_looks) or min_looks < 0:
        raise ValueError("min_looks must be finite and nonnegative")
    with h5py.File(path, "r") as file:
        group = file[f"{ROOT}/frequency{frequency}"]
        if channel not in group:
            raise ValueError(f"Channel {channel} is unavailable")
        dataset = group[channel]
        if dataset.ndim != 2 or dataset.dtype.kind not in ("f", "i", "u"):
            raise ValueError("Covariance power must be a real two-dimensional array")
        x, y = group["xCoordinates"][:], group["yCoordinates"][:]
        if len(x) < 2 or len(y) < 2 or dataset.shape != (len(y), len(x)):
            raise ValueError("Invalid coordinate dimensions")
        dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
        if dx == 0 or dy == 0 or not np.allclose(np.diff(x), dx) or not np.allclose(np.diff(y), dy):
            raise ValueError("Nonuniform or nonmonotonic coordinate grid")
        crs = CRS.from_epsg(int(group["projection"][()]))
        project = Transformer.from_crs(area.crs, crs, always_xy=True)
        geom = transform(shape(area.geometry), project.transform, interleaved=False)
        xmin, ymin, xmax, ymax = geom.bounds
        cols = np.flatnonzero((x >= xmin - abs(dx) / 2) & (x <= xmax + abs(dx) / 2))
        rows = np.flatnonzero((y >= ymin - abs(dy) / 2) & (y <= ymax + abs(dy) / 2))
        if not cols.size or not rows.size:
            raise ValueError("AOI has no overlap with scene")
        row, col = (
            slice(int(rows.min()), int(rows.max()) + 1),
            slice(int(cols.min()), int(cols.max()) + 1),
        )
        if rows.size * cols.size > area.max_pixels:
            raise ValueError("AOI exceeds pixel budget; reduce AOI before reading HDF5")
        data = dataset[row, col].astype("float32")
        valid = np.isfinite(data) & (data > 0)
        for key in ("_FillValue", "missing_value"):
            if key in dataset.attrs:
                valid &= data != dataset.attrs[key]
        quality = []
        if "numberOfLooks" in group:
            looks = group["numberOfLooks"][row, col]
            valid &= np.isfinite(looks) & (looks >= min_looks)
            quality.append(f"numberOfLooks >= {min_looks}")
        if "mask" in group:
            mask = group["mask"][row, col]
            # GCOV specification 1.6.0: 0 = invalid/partially focused contributors;
            # 255 = outside radar extent. Positive subswath IDs are not water classes.
            valid &= (mask != 0) & (mask != 255)
            quality.append("mask invalid contributors (0) excluded")
            quality.append("mask outside acquisition extent (255) excluded")
            fill = group["mask"].attrs.get("_FillValue")
            if fill is not None:
                valid &= mask != fill
                quality.append("mask explicit _FillValue excluded")
        data[~valid] = np.nan
        x, y = x[col], y[row]
        if dx < 0:
            x, data = x[::-1], data[:, ::-1]
        if dy > 0:
            y, data = y[::-1], data[::-1, :]
        affine = Affine(
            abs(dx), 0, float(x[0]) - abs(dx) / 2, 0, -abs(dy), float(y[0]) + abs(dy) / 2
        )
        inside = geometry_mask([mapping(geom)], out_shape=data.shape, transform=affine, invert=True)
        data[~inside] = np.nan
        if not np.isfinite(data).any():
            raise ValueError("AOI has no valid pixel overlap")
        return Raster(
            data,
            affine,
            crs,
            {
                "channel": channel,
                "frequency": frequency,
                "quality_filters": quality,
                "mask_semantics": "GCOV 1.6.0: invalid 0/outside 255 and explicit fill excluded; no water class inferred",
                "grid_spacing_may_differ_from_accuracy": True,
                "window_shape": list(data.shape),
            },
        )
