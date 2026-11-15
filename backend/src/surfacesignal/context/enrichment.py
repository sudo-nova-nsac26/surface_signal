"""Bounded enrichment on verified SAR candidates and measured valid coverage."""

import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.warp import transform_geom
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from surfacesignal.context.importer import bounded, digest
from surfacesignal.context.spatial import raster_summary, summarize_municipalities
from surfacesignal.context.validation import compare_reference
from surfacesignal.storage import read_json


def candidate_geometry(settings, analysis, budgets):
    folder = settings.artifacts_dir / analysis.analysis_id
    features = read_json(bounded(folder / "change-candidates.geojson", budgets.max_input_bytes))[
        "features"
    ]
    if len(features) > budgets.max_records:
        raise ValueError("Candidate feature budget exceeded")
    return unary_union([shape(feature["geometry"]) for feature in features])


def candidate_summary(settings, analysis, item, geometry, budgets):
    if geometry.is_empty:
        return {
            "status": "unavailable",
            "limitations": ["No candidate geometry; absence does not establish absence of water."],
        }
    dataset = item["dataset"]
    source = dataset["source_id"]
    path = (
        settings.root / "data/context/raw" / analysis.area_id / source / digest(item)[:24] / "input"
    )
    path = bounded(path, budgets.max_input_bytes)
    if source == "ibge":
        result = summarize_municipalities(
            read_json(path), mapping(geometry), max_features=budgets.max_records
        )
    else:
        result = raster_summary(
            path,
            mapping(geometry),
            source,
            {**dataset, **dataset["parameters"]},
            max_pixels=budgets.max_pixels,
        )
    return {**result, "aggregation_scope": "union_of_sar_candidates"}


def validate_reference(settings, analysis, item, candidate, budgets):
    folder = settings.artifacts_dir / analysis.analysis_id
    path = bounded(folder / "delta-db.tif", budgets.max_input_bytes)
    with rasterio.open(path) as src:
        if src.width * src.height > budgets.max_pixels:
            raise ValueError("SAR validation coverage pixel budget exceeded")
        data = src.read(1, masked=True)
        valid = ~np.ma.getmaskarray(data) & np.isfinite(data.data)
        polygons = []
        for geometry, _ in shapes(valid.astype("uint8"), mask=valid, transform=src.transform):
            if len(polygons) >= budgets.max_records:
                raise ValueError("SAR validation coverage feature budget exceeded")
            polygons.append(shape(transform_geom(src.crs, "EPSG:4326", geometry)))
    coverage = unary_union(polygons)
    reference = item["normalized"]["reference"]
    dataset = item["dataset"]
    if coverage.is_empty or candidate.is_empty:
        return {
            "status": "not_validated",
            "metrics": None,
            "limitations": ["No nonempty candidate and measured coverage available."],
        }
    result = compare_reference(
        mapping(candidate),
        reference["reference_geometry"],
        mapping(coverage),
        reference["valid_coverage"],
        observed_at=analysis.scenes[1].start_time.isoformat(),
        reference_at=reference["reference_at"],
        tolerance_hours=dataset["parameters"]["tolerance_hours"],
        independent=reference["independent"] and dataset["source_id"] != "opera-dswx-s1",
        quality_verified=reference["quality_verified"],
        reference_id=dataset["dataset_id"],
    )
    result["reference"] = {
        k: reference[k]
        for k in ("reference_at", "independent", "quality_verified", "method", "class_mapping")
    }
    result["provenance"].update(
        source_sha256=dataset["source_sha256"], dataset_version=dataset["dataset_version"]
    )
    return result
