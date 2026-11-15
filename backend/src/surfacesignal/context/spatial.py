"""Bounded local environmental summaries; never derive flood truth from context.

Categorical areas use exact clipped pixel footprints in a local equal-area CRS.
DSM slopes use a metric projected grid, with nodata neighbours excluded.
"""

import math
from pathlib import Path

import numpy as np
import rasterio
import shapely
from pyproj import CRS, Transformer
from rasterio.features import geometry_window
from rasterio.warp import Resampling, calculate_default_transform, reproject
from shapely import transform as shapely_transform
from shapely.geometry import mapping, shape


def transform(project, geometry):
    return shapely_transform(geometry, project, interleaved=False)


WORLD_CLASSES = {
    10: "tree_cover",
    20: "other",
    30: "other",
    40: "cropland",
    50: "built_up",
    60: "other",
    70: "other",
    80: "water",
    90: "other",
    95: "other",
    100: "other",
}


def _geometry(value):
    geom = shape(value)
    if geom.geom_type not in {"Polygon", "MultiPolygon"} or geom.is_empty or not geom.is_valid:
        raise ValueError("Valid polygon required")
    if not all(math.isfinite(x) for x in geom.bounds):
        raise ValueError("Finite coordinates required")
    xmin, ymin, xmax, ymax = geom.bounds
    if not (-180 <= xmin <= xmax <= 180 and -90 <= ymin <= ymax <= 90):
        raise ValueError("Geometry must use EPSG:4326")
    return geom


def _projectors(geom):
    center = geom.centroid
    equal = CRS.from_proj4(f"+proj=laea +lat_0={center.y} +lon_0={center.x} +datum=WGS84 +units=m")
    return equal, Transformer.from_crs(4326, equal, always_xy=True).transform


def raster_summary(path, geometry, source_id, metadata, *, max_pixels=1_000_000):
    """Summarize one local raster over an explicit EPSG:4326 polygon.

    MapBiomas requires reference_year, asset_id, band, product_kind
    (annual/monthly/frequency), and explicit water_classes or frequency_scale.
    DSM requires vertical_datum and native_unit=m. No class code is guessed.
    """
    path = Path(path).absolute()
    if any(p.is_symlink() for p in [path, *path.parents]) or not path.is_file():
        raise ValueError("Expected regular local raster")
    if isinstance(max_pixels, bool) or not isinstance(max_pixels, int) or max_pixels < 1:
        raise ValueError("Invalid pixel budget")
    geom = _geometry(geometry)
    equal, project = _projectors(geom)
    target = transform(project, geom)
    year = metadata.get("reference_year")
    if source_id == "worldcover" and (year != 2021 or metadata.get("dataset_version") != "v200"):
        raise ValueError("WorldCover requires 2021 v200")
    if source_id == "mapbiomas-water":
        if metadata.get("dataset_version") != "5":
            raise ValueError("MapBiomas requires dataset_version 5")
        if not isinstance(year, int) or not 1985 <= year <= 2025:
            raise ValueError("MapBiomas historical year must be 1985–2025")
        if not metadata.get("asset_id") or not metadata.get("band"):
            raise ValueError("MapBiomas asset and band required")
        kind = metadata.get("product_kind")
        if kind not in {"annual", "monthly", "frequency"}:
            raise ValueError("Explicit MapBiomas product kind required")
        if kind == "monthly" and metadata.get("reference_month") not in range(1, 13):
            raise ValueError("Monthly reference month required")
        if kind != "frequency" and not metadata.get("water_classes"):
            raise ValueError("Explicit water class mapping required")
        if kind == "frequency" and metadata.get("frequency_scale") not in {1, 100}:
            raise ValueError("Frequency scale must be explicitly 1 or 100")
    if source_id == "jrc-gsw" and (
        metadata.get("dataset_version") != "1.5"
        or year != 2024
        or metadata.get("product_kind") != "occurrence"
        or metadata.get("frequency_scale") != 100
    ):
        raise ValueError("JRC GSW requires documented v1.5 occurrence 1984–2024")
    if source_id == "copernicus-dem" and (
        metadata.get("native_unit") != "m" or not metadata.get("vertical_datum")
    ):
        raise ValueError("DSM metre units and vertical datum required")
    if source_id not in {"worldcover", "mapbiomas-water", "jrc-gsw", "copernicus-dem", "gpm-imerg"}:
        raise ValueError("Unsupported raster source")
    base = {
        "status": "unavailable",
        "coverage_fraction": 0.0,
        "valid_area_km2": None,
        "reference_year": year,
        "limitations": ["No valid spatial coverage"],
        "aggregation": "exact pixel-footprint intersection in local equal-area CRS",
        "aggregation_scope": metadata.get("aggregation_scope", "AOI"),
        "denominator": "valid contextual coverage within supplied polygon",
    }
    with rasterio.open(path) as src:
        if src.crs is None or src.count != 1 or src.nodata is None:
            raise ValueError("Single band raster with CRS and explicit nodata required")
        if metadata.get("crs") and CRS.from_user_input(metadata["crs"]) != CRS.from_user_input(
            src.crs
        ):
            raise ValueError("Raster CRS differs from provenance")
        to_native = Transformer.from_crs(4326, src.crs, always_xy=True).transform
        native_geom = transform(to_native, geom)
        try:
            window = geometry_window(src, [mapping(native_geom)])
        except rasterio.errors.WindowError:
            return base
        if window.width * window.height > max_pixels:
            raise ValueError("Raster window pixel budget exceeded")
        data = src.read(1, window=window, masked=True).astype(float)
        affine = src.window_transform(window)
        native_equal = Transformer.from_crs(src.crs, equal, always_xy=True).transform
        valid = ~np.ma.getmaskarray(data) & np.isfinite(data.data)
        areas = np.zeros(data.shape, dtype=float)
        # Vectorized exact intersections retain edge fractions; bounded batches limit memory.
        rows, cols = np.nonzero(valid)
        for offset in range(0, len(rows), 8192):
            r, c = rows[offset : offset + 8192], cols[offset : offset + 8192]
            dx = np.array([0, 1, 1, 0])
            dy = np.array([0, 0, 1, 1])
            x = affine.a * (c[:, None] + dx) + affine.b * (r[:, None] + dy) + affine.c
            y = affine.d * (c[:, None] + dx) + affine.e * (r[:, None] + dy) + affine.f
            ex, ey = native_equal(x, y)
            pixels = shapely.polygons(np.stack([ex, ey], axis=-1))
            areas[r, c] = shapely.area(shapely.intersection(pixels, target))
        total = float(areas.sum())
        if total <= 0:
            return base
        coverage = min(1.0, total / target.area)
        result = {
            **base,
            "status": "available" if coverage >= 0.999 else "partial",
            "coverage_fraction": coverage,
            "valid_area_km2": total / 1e6,
            "limitations": ["Spatial context does not confirm flooding"],
            "native_pixel_size": [abs(affine.a), abs(affine.e)],
        }
        active = areas > 0
        if source_id == "mapbiomas-water":
            result.update(
                collection="MapBiomas Água Coleção 5",
                product_kind=kind,
                reference_month=metadata.get("reference_month"),
                overlap_km2=None,
                overlap_fraction=None,
                limitations=result["limitations"]
                + ["Historical reference, not a contemporary observation"],
            )
            if kind == "frequency":
                fraction = data.data / metadata["frequency_scale"]
                if np.any((fraction[active] < 0) | (fraction[active] > 1)):
                    raise ValueError("Frequency outside documented scale")
                result["mean_frequency"] = float(np.sum(fraction[active] * areas[active]) / total)
            else:
                water = np.isin(data.data, metadata["water_classes"]) & active
                area = float(areas[water].sum())
                result.update(
                    overlap_km2=area / 1e6,
                    overlap_fraction=area / total,
                    denominator="valid contextual coverage within supplied polygon",
                )
        elif source_id == "jrc-gsw":
            fraction = data.data[active] / 100
            if np.any((fraction < 0) | (fraction > 1)):
                raise ValueError("JRC occurrence outside documented 0..100 percentage scale")
            result.update(
                source_id="jrc-gsw",
                collection="JRC Global Surface Water v1.5",
                reference_start_year=1984,
                reference_year=2024,
                mean_frequency=float(np.sum(fraction * areas[active]) / total),
                overlap_km2=None,
                overlap_fraction=None,
                limitations=result["limitations"]
                + ["Long-term occurrence, not contemporary water extent."],
            )
        elif source_id == "worldcover":
            classes = {
                k: 0.0 for k in ("water", "tree_cover", "cropland", "built_up", "other", "unknown")
            }
            for code in np.unique(data.data[active]):
                group = WORLD_CLASSES.get(code, "unknown")
                classes[group] += float(areas[(data.data == code) & active].sum())
            result["classes"] = [
                {"class_id": k, "label": k, "percent": v / total * 100} for k, v in classes.items()
            ]
        elif source_id == "gpm-imerg":
            result["value"] = float(np.sum(data.data[active] * areas[active]) / total)
        else:
            result.update(
                elevation_m=float(np.sum(data.data[active] * areas[active]) / total),
                slope_deg=None,
                surface_model="DSM",
                vertical_datum=metadata["vertical_datum"],
            )
            # Warp to local metric equal-area grid, bound allocation before loading.
            bounds = rasterio.transform.array_bounds(*data.shape, affine)
            dst_transform, width, height = calculate_default_transform(
                src.crs, equal, data.shape[1], data.shape[0], *bounds
            )
            if width * height > max_pixels:
                raise ValueError("Metric DSM grid pixel budget exceeded")
            dest = np.full((height, width), np.nan)
            reproject(
                np.where(valid, data.data, np.nan),
                dest,
                src_transform=affine,
                src_crs=src.crs,
                src_nodata=np.nan,
                dst_transform=dst_transform,
                dst_crs=equal,
                dst_nodata=np.nan,
                resampling=Resampling.bilinear,
            )
            if min(height, width) >= 3:
                dy, dx = np.gradient(dest, abs(dst_transform.e), abs(dst_transform.a))
                slope = np.degrees(np.arctan(np.hypot(dx, dy)))
                from rasterio.features import geometry_mask

                inside = geometry_mask(
                    [mapping(target)], out_shape=dest.shape, transform=dst_transform, invert=True
                )
                # No one-sided boundary derivative; require all four neighbours.
                eligible = np.isfinite(slope) & inside & np.isfinite(dest)
                eligible[[0, -1], :] = False
                eligible[:, [0, -1]] = False
                if eligible.any():
                    result["slope_deg"] = float(slope[eligible].mean())
            result["limitations"].append(
                "DSM includes vegetation/buildings; no river-gauge datum comparison"
            )
        return result


def summarize_municipalities(collection, geometry, *, max_features=10000):
    """Validate municipal GeoJSON and report geometric intersections, never impacts."""
    if collection.get("type") != "FeatureCollection" or "crs" in collection:
        raise ValueError("EPSG:4326 GeoJSON FeatureCollection required")
    features = collection.get("features")
    if not isinstance(features, list) or len(features) > max_features:
        raise ValueError("Municipal feature budget exceeded")
    geom = _geometry(geometry)
    _, project = _projectors(geom)
    seen, items = set(), []
    for feature in features:
        props = feature.get("properties", {})
        code = str(props.get("codarea", props.get("CD_MUN", "")))
        name = props.get("nome", props.get("NM_MUN"))
        if (
            len(code) != 7
            or not code.isdigit()
            or not isinstance(name, str)
            or not name.strip()
            or code in seen
        ):
            raise ValueError("Verified unique municipality code and name required")
        seen.add(code)
        municipal = _geometry(feature["geometry"])
        intersection = municipal.intersection(geom)
        area = transform(project, intersection).area
        if area > 0:
            items.append({"municipality_code": code, "name": name, "intersection_km2": area / 1e6})
    return {
        "status": "available" if items else "unavailable",
        "municipalities_intersecting_candidate": items,
        "limitations": ["Geometric intersection only; no confirmed impact or population inference"],
    }
