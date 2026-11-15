"""Bounded vector import and positive intersections, without inferred valid coverage."""

import math
from pathlib import Path

from pyproj import Transformer
from shapely import transform
from shapely.geometry import shape
from shapely.ops import unary_union

from surfacesignal.preparation.models import ContextSource
from surfacesignal.publication import _check_public
from surfacesignal.storage import checksum, read_json


def safe_path(path):
    path = Path(path).absolute()
    if any(p.is_symlink() for p in [path, *path.parents]):
        raise ValueError("Symlinked preparation path")
    return path


def bounded_json(path, budgets):
    path = safe_path(path)
    if path.stat().st_size > budgets.max_input_bytes:
        raise ValueError("Input byte budget exceeded")
    value = read_json(path)
    if not isinstance(value, dict):
        raise ValueError("Expected JSON object")
    return value


def geometries(collection, budgets, *, context=False):
    if (
        not isinstance(collection, dict)
        or collection.get("type") != "FeatureCollection"
        or "crs" in collection
    ):
        raise ValueError("Expected EPSG:4326 FeatureCollection without CRS override")
    features = collection.get("features")
    if not isinstance(features, list) or len(features) > budgets.max_features:
        raise ValueError("Feature budget exceeded or invalid features")
    count = 0
    ids = set()
    result = []

    def coordinates(values):
        nonlocal count
        if not isinstance(values, (list, tuple)) or not values:
            raise ValueError("Invalid geometry coordinates")
        if isinstance(values[0], (float, int)):
            count += 1
            if count > budgets.max_coordinates:
                raise ValueError("Coordinate budget exceeded")
            if len(values) != 2 or not all(
                isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
                for v in values
            ):
                raise ValueError("Coordinates must be finite 2D longitude/latitude")
            if not (-180 <= values[0] <= 180 and -90 <= values[1] <= 90):
                raise ValueError("Coordinates outside longitude/latitude bounds")
        else:
            for v in values:
                coordinates(v)

    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ValueError("Expected Feature")
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            raise ValueError("Expected geometry object")
        if geometry.get("type") not in (
            {"Point", "Polygon", "MultiPolygon"} if context else {"Polygon", "MultiPolygon"}
        ):
            raise ValueError("Unsupported geometry")
        coordinates(geometry.get("coordinates"))
        geom = shape(geometry)
        if geom.is_empty or not geom.is_valid:
            raise ValueError("Invalid geometry")
        if context:
            props = feature.get("properties") or {}
            if not isinstance(props, dict):
                raise ValueError("Expected feature properties object")
            if any(
                not isinstance(props.get(k), str) or not props[k].strip()
                for k in ("id", "name", "kind")
            ):
                raise ValueError("Context requires stable id, name and kind")
            if props["id"] in ids:
                raise ValueError("Duplicate context ID")
            ids.add(props["id"])
        result.append(geom)
    return result


def read_context(path, budgets):
    value = bounded_json(path, budgets)
    ContextSource.model_validate(value.get("metadata", {}))
    _check_public(value, "__no_local_root__")
    geometries(value, budgets, context=True)
    return {"collection": value, "sha256": checksum(path)}


def intersections(context, collection, budgets):
    features = context["collection"]["features"]
    local = geometries(context["collection"], budgets, context=True)
    candidates = geometries(collection, budgets)
    union = unary_union(candidates)
    results = []
    for feature, geom in zip(features, local, strict=True):
        overlap = None
        hit = None
        if geom.geom_type == "Point":
            if union.covers(geom):
                hit = True
        elif union.intersects(geom):
            center = geom.centroid
            zone = min(60, max(1, int((center.x + 180) / 6) + 1))
            crs = (32700 if center.y < 0 else 32600) + zone
            project = Transformer.from_crs(4326, crs, always_xy=True).transform
            area = transform(geom.intersection(union), project, interleaved=False).area / 1e6
            if not math.isfinite(area):
                raise ValueError("Invalid projected overlap")
            if area > 0:
                hit, overlap = True, area
        props = feature["properties"]
        results.append(
            {
                "feature_id": props["id"],
                "name": props["name"],
                "kind": props["kind"],
                "geometry_type": geom.geom_type,
                "intersects": hit,
                "overlap_km2": overlap,
                "coverage": "unknown",
            }
        )
    return results
