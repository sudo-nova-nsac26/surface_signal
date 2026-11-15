from copy import deepcopy

import pytest
from shapely.geometry import box, mapping

from surfacesignal.preparation.context import intersections, read_context
from surfacesignal.preparation.models import Budgets
from surfacesignal.storage import write_json


def collection(geometry):
    return {
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "geometry": geometry, "properties": {}}],
    }


def context_file(tmp_path):
    value = collection(mapping(box(-52, -30, -51.999, -29.999)))
    value["features"][0]["properties"] = {
        "id": "school",
        "name": "Illustrative school",
        "kind": "school",
    }
    value["metadata"] = {
        "source_url": "https://example.org/illustrative-context",
        "publisher": "Synthetic fixture",
        "retrieved_at": "2026-11-15T00:00:00Z",
        "reference_date": "2026-07-01",
        "version": "1",
        "usage_statement": "Synthetic test fixture only",
        "synthetic": True,
    }
    path = tmp_path / "context.geojson"
    write_json(path, value)
    return path


def test_overlap_union_and_unknown_negative(tmp_path):
    ctx = read_context(context_file(tmp_path), Budgets())
    geometry = mapping(box(-52, -30, -51.9995, -29.999))
    candidates = collection(geometry)
    single = intersections(ctx, candidates, Budgets())[0]
    candidates["features"] *= 2
    duplicate = intersections(ctx, candidates, Budgets())[0]
    assert single["intersects"] is True
    assert 0.005 < single["overlap_km2"] < 0.006
    assert duplicate["overlap_km2"] == single["overlap_km2"]
    empty = intersections(ctx, collection(mapping(box(-51, -29, -50, -28))), Budgets())[0]
    assert empty["intersects"] is None and empty["overlap_km2"] is None
    assert empty["coverage"] == "unknown"
    boundary = intersections(
        ctx, collection(mapping(box(-51.999, -30, -51.998, -29.999))), Budgets()
    )[0]
    assert boundary["intersects"] is None


def test_point_membership_and_multipolygon(tmp_path):
    path = context_file(tmp_path)
    from surfacesignal.storage import read_json

    value = read_json(path)
    value["features"][0]["geometry"] = {"type": "Point", "coordinates": [-51.9997, -29.9997]}
    write_json(path, value)
    ctx = read_context(path, Budgets())
    geometry = {
        "type": "MultiPolygon",
        "coordinates": [mapping(box(-52, -30, -51.999, -29.999))["coordinates"]],
    }
    result = intersections(ctx, collection(geometry), Budgets())[0]
    assert result["intersects"] is True and result["overlap_km2"] is None


@pytest.mark.parametrize(
    "kind", ["metadata", "duplicate", "coords", "invalid", "private_url", "crs"]
)
def test_invalid_context_rejected(tmp_path, kind):
    from surfacesignal.storage import read_json

    path = context_file(tmp_path)
    value = read_json(path)
    if kind == "metadata":
        del value["metadata"]["publisher"]
    elif kind == "duplicate":
        value["features"].append(deepcopy(value["features"][0]))
    elif kind == "coords":
        value["features"][0]["geometry"] = {"type": "Point", "coordinates": [190, -30]}
    elif kind == "invalid":
        value["features"][0]["geometry"] = {
            "type": "Polygon",
            "coordinates": [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]],
        }
    elif kind == "private_url":
        value["metadata"]["source_url"] = "https://example.org/data?access_token=secret"
    else:
        value["crs"] = {"type": "name", "properties": {"name": "EPSG:3857"}}
    write_json(path, value)
    with pytest.raises(ValueError):
        read_context(path, Budgets())


def test_budgets_before_geometry_and_symlinks(tmp_path):
    path = context_file(tmp_path)
    for budgets in [Budgets(max_input_bytes=1), Budgets(max_coordinates=1)]:
        with pytest.raises(ValueError, match="budget"):
            read_context(path, budgets)
    linked = tmp_path / "link.geojson"
    linked.symlink_to(path)
    with pytest.raises(ValueError):
        read_context(linked, Budgets())
    for key in ["max_input_bytes", "max_features", "max_coordinates", "max_output_bytes"]:
        with pytest.raises(ValueError):
            Budgets(**{key: 0})
