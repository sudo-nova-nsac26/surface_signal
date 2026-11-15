"""Explicit bounded local imports. Raw inputs remain outside all publication paths."""

import csv
import hashlib
import json
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

from surfacesignal.api.service import Repository
from surfacesignal.context.models import (
    ContextBudgets,
    ContextDataset,
    HydroObservation,
    RainInterval,
)
from surfacesignal.preparation.context import safe_path
from surfacesignal.publication import _check_public
from surfacesignal.storage import checksum, read_json, safe_id, write_json


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def bounded(path, limit):
    path = safe_path(path)
    if path.stat().st_size > limit:
        raise ValueError("Environmental input byte budget exceeded")
    return path


def normalize_hydrology(rows, dataset):
    records = {}
    for row in rows:
        value = row.get("value")
        value = None if value in (None, "") else float(value)
        parameter = row["parameter"]
        native = row["unit"]
        scales = {
            "river_level": {"m": 1, "cm": 0.01},
            "rainfall": {"mm": 1, "cm": 10, "m": 1000},
            "discharge": {"m3/s": 1},
        }
        if native not in scales.get(parameter, {}):
            raise ValueError("Unsupported hydrological unit")
        observed = datetime.fromisoformat(row["observed_at"].replace("Z", "+00:00"))
        quality = row["quality_status"]
        if quality not in {"valid", "provisional", "rejected", "missing"}:
            raise ValueError("Explicit hydrological quality status required")
        item = HydroObservation(
            station_id=row["station_id"],
            station_name=row["station_name"],
            observed_at=observed,
            parameter=parameter,
            value=value * scales[parameter][native]
            if value is not None and quality in {"valid", "provisional"}
            else None,
            unit={"river_level": "m", "rainfall": "mm", "discharge": "m3/s"}[parameter],
            native_unit=native,
            original_timezone=row.get("original_timezone") or str(observed.tzinfo),
            quality_status=quality,
            method=row["method"],
            datum=row.get("datum") or None,
            longitude=None if row.get("longitude") in (None, "") else row["longitude"],
            latitude=None if row.get("latitude") in (None, "") else row["latitude"],
            source_id=dataset.source_id,
            synthetic=dataset.synthetic,
        )
        if not dataset.observed_start <= item.observed_at <= dataset.observed_end:
            raise ValueError("Measurement outside declared observation interval")
        key = (item.station_id, item.parameter, item.observed_at)
        if key in records and records[key] != item:
            raise ValueError("Conflicting duplicate station reading")
        records[key] = item
    return [r.model_dump(mode="json") for _, r in sorted(records.items())]


def import_dataset(settings, area_id, source_id, file, metadata, *, dry_run=False, budgets=None):
    budgets = budgets or ContextBudgets()
    area = Repository(settings).area(area_id)
    file = bounded(file, budgets.max_input_bytes)
    dataset = ContextDataset.model_validate(
        read_json(bounded(metadata, min(budgets.max_input_bytes, 1_000_000)))
    )
    from surfacesignal.providers.environmental import context_sources

    known = {s["source_id"] for s in context_sources()}
    if source_id not in known or dataset.source_id != source_id:
        raise ValueError("Unknown or mismatched environmental source")
    if checksum(file) != dataset.source_sha256:
        raise ValueError("Environmental source checksum mismatch")
    _check_public(dataset.model_dump(mode="json"), settings.root)
    suffix = file.suffix.lower()
    normalized = {}
    if source_id in {"ana-hidroweb", "sgb-taquari"}:
        if suffix == ".csv":
            with file.open(newline="", encoding="utf-8-sig") as stream:
                rows = list(csv.DictReader(stream))
        elif suffix == ".json":
            rows = read_json(file)["records"]
        else:
            raise ValueError("Hydrology requires CSV or JSON records")
        if len(rows) > budgets.max_records:
            raise ValueError("Environmental record budget exceeded")
        normalized["hydrology"] = normalize_hydrology(rows, dataset)
    elif source_id == "gpm-imerg":
        if dataset.parameters.get("run") not in {
            "early",
            "late",
            "final",
        } or not dataset.dataset_version.startswith("07"):
            raise ValueError("IMERG requires run and V07 subversion")
        if not dataset.parameters.get("spatial_support"):
            raise ValueError("IMERG requires explicit AOI/pixel spatial support")
        if suffix != ".json":
            raise ValueError(
                "IMERG import requires a documented local interval series JSON; raster alone has no temporal coverage"
            )
        rows = read_json(file)["records"]
        if len(rows) > budgets.max_records:
            raise ValueError("Environmental record budget exceeded")
        intervals = [RainInterval.model_validate(r) for r in rows]
        if any(
            r.start < dataset.observed_start
            or r.end > dataset.observed_end
            or r.unit != dataset.native_unit
            for r in intervals
        ):
            raise ValueError("Rainfall interval or unit differs from provenance")
        from surfacesignal.context.temporal import accumulate_rainfall

        accumulate_rainfall(intervals, dataset.observed_end)
        normalized["rainfall"] = [r.model_dump(mode="json") for r in intervals]
    elif source_id in {"mapbiomas-water", "worldcover", "copernicus-dem"}:
        if suffix not in {".tif", ".tiff"}:
            raise ValueError("Expected local GeoTIFF crop")
        from surfacesignal.context.spatial import raster_summary

        normalized["spatial"] = raster_summary(
            file,
            Repository(settings).area(area_id).geometry,
            source_id,
            {**dataset.model_dump(mode="json"), **dataset.parameters},
            max_pixels=budgets.max_pixels,
        )
    elif source_id in {"copernicus-ems", "opera-dswx-s1", "sentinel-2"}:
        from surfacesignal.context.models import QualifiedReference

        reference = QualifiedReference.model_validate(read_json(file))
        tolerance = dataset.parameters.get("tolerance_hours")
        if (
            isinstance(tolerance, bool)
            or not isinstance(tolerance, (int, float))
            or not 0 <= tolerance <= 168
        ):
            raise ValueError("Explicit reference tolerance in hours (0..168) required")
        if not dataset.observed_start <= reference.reference_at <= dataset.observed_end:
            raise ValueError("Reference acquisition outside metadata interval")
        if dataset.crs != "EPSG:4326" or not reference.class_mapping:
            raise ValueError("Reference CRS and class mapping required")
        normalized["reference"] = reference.model_dump(mode="json")
    elif source_id == "ibge":
        from surfacesignal.context.spatial import summarize_municipalities

        normalized["spatial"] = summarize_municipalities(
            read_json(file),
            Repository(settings).area(area_id).geometry,
            max_features=budgets.max_records,
        )
    else:
        raise ValueError("This source supports discovery only; no observation importer enabled")
    payload = {
        "area_id": area_id,
        "geometry": area.geometry,
        "method_version": "environmental-import-v1",
        "dataset": dataset.model_dump(mode="json"),
        "normalized": normalized,
    }
    _check_public(payload, settings.root)
    if len(json.dumps(payload, allow_nan=False).encode()) > budgets.max_output_bytes:
        raise ValueError("Environmental normalized output byte budget exceeded")
    identifier = digest(payload)[:24]
    if dry_run:
        return {
            "import_id": identifier,
            "dry_run": True,
            "source_id": source_id,
            "records": sum(len(v) for v in normalized.values()),
        }
    base = safe_path(settings.root / "data/context/raw" / safe_id(area_id) / safe_id(source_id))
    base.mkdir(parents=True, exist_ok=True)
    folder = safe_path(base / identifier)
    if folder.exists():
        existing = load_import(folder, budgets)
        if existing != payload:
            raise ValueError("Existing import identity mismatch")
    else:
        staging = Path(tempfile.mkdtemp(prefix=".import-", dir=base))
        try:
            shutil.copyfile(file, staging / "input")
            if checksum(staging / "input") != dataset.source_sha256:
                raise ValueError("Source changed during import")
            write_json(staging / "normalized.json", payload)
            write_json(
                staging / "manifest.json",
                {
                    "import_id": identifier,
                    "input_sha256": dataset.source_sha256,
                    "normalized_sha256": checksum(staging / "normalized.json"),
                },
            )
            os.rename(staging, folder)
        finally:
            if staging.exists():
                shutil.rmtree(staging)
    write_json(
        base / "current.json",
        {"import_id": identifier, "manifest_sha256": checksum(folder / "manifest.json")},
    )
    return {"import_id": identifier, "source_id": source_id, "synthetic": dataset.synthetic}


def load_import(folder, budgets):
    folder = safe_path(folder)
    manifest = read_json(bounded(folder / "manifest.json", 4096))
    payload = read_json(bounded(folder / "normalized.json", budgets.max_input_bytes))
    dataset = ContextDataset.model_validate(payload["dataset"])
    if (
        manifest["import_id"] != folder.name
        or digest(payload)[:24] != folder.name
        or checksum(folder / "normalized.json") != manifest["normalized_sha256"]
        or checksum(bounded(folder / "input", budgets.max_input_bytes)) != dataset.source_sha256
        or manifest["input_sha256"] != dataset.source_sha256
    ):
        raise ValueError("Environmental import integrity failure")
    return payload


def current_imports(settings, area_id, budgets):
    base = safe_path(settings.root / "data/context/raw" / safe_id(area_id))
    result = []
    total = 0
    for pointer in sorted(base.glob("*/current.json")):
        p = read_json(bounded(pointer, 4096))
        folder = safe_path(pointer.parent / safe_id(p["import_id"]))
        if checksum(bounded(folder / "manifest.json", 4096)) != p["manifest_sha256"]:
            raise ValueError("Environmental import pointer integrity failure")
        total += bounded(folder / "normalized.json", budgets.max_input_bytes).stat().st_size
        if total > budgets.max_input_bytes:
            raise ValueError("Combined environmental input byte budget exceeded")
        item = load_import(folder, budgets)
        if item["area_id"] != area_id or item["dataset"]["source_id"] != pointer.parent.name:
            raise ValueError("Environmental import identity mismatch")
        if item["geometry"] != Repository(settings).area(area_id).geometry:
            raise ValueError("Environmental import AOI changed; reimport offline")
        result.append(item)
    return result
