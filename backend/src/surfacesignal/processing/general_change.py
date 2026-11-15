"""Offline, content-addressed radar change summaries (never flood truth)."""

import hashlib
import json
import os
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.warp import transform_geom
from scipy.ndimage import label

from surfacesignal.processing.pipeline import verify_artifacts
from surfacesignal.storage import checksum, read_json, safe_id, write_json

ALGORITHM = "general-radar-change-v1"
DERIVED_ARTIFACT_NAMES = frozenset(
    {
        "general-change.geojson",
        "radar-increase.geojson",
        "radar-decrease.geojson",
        "general-statistics.json",
        "general-evidence.json",
        "manifest.json",
    }
)


def _safe(root, *parts):
    base = Path(root).resolve()
    path = base
    for part in parts:
        path = path / part
        if path.is_symlink():
            raise ValueError("Symlinked derived or original path")
    if not path.resolve().is_relative_to(base):
        raise ValueError("Path escapes root")
    return path


def _identity(manifest):
    value = {
        k: manifest[k]
        for k in (
            "analysis_id",
            "algorithm",
            "parameters",
            "source_manifest_sha256",
            "source_delta_sha256",
        )
    }
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()[
        :24
    ]


def _load(root, aid, did, *, verify=False):
    folder = _safe(root, "data", "derived", aid, safe_id(did))
    manifest = read_json(_safe(folder, "manifest.json"))
    if (
        manifest["analysis_id"] != aid
        or manifest["derived_id"] != did
        or _identity(manifest) != did
    ):
        raise ValueError("Derived identity mismatch")
    if set(manifest["artifacts"]) != DERIVED_ARTIFACT_NAMES - {"manifest.json"}:
        raise ValueError("Incomplete derived inventory")
    for name, sha in manifest["artifacts"].items():
        path = _safe(folder, name)
        if not path.is_file() or (checksum(path) != sha):
            raise ValueError("Derived artifact integrity failure")
    original = _safe(root, "artifacts", aid, "manifest.json")
    if checksum(original) != manifest["source_manifest_sha256"]:
        raise ValueError("Original manifest integrity failure")
    if verify:
        source = read_json(original)
        if source["artifacts"]["delta-db.tif"] != manifest["source_delta_sha256"]:
            raise ValueError("Original delta identity mismatch")
        for name, sha in source["artifacts"].items():
            path = _safe(root, "artifacts", aid, name)
            if not path.is_file() or (
                path.suffix not in {".tif", ".h5", ".hdf5"} and checksum(path) != sha
            ):
                raise ValueError("Original artifact integrity failure")
        if read_json(folder / "general-statistics.json") != manifest["statistics"]:
            raise ValueError("Derived statistics mismatch")
    return manifest


def load_derived(root: Path, analysis_id: str, *, verify=False) -> dict | None:
    aid = safe_id(analysis_id)
    pointer = _safe(root, "data", "derived", aid, "current.json")
    if not pointer.exists():
        return None
    try:
        pointer_data = read_json(pointer)
        did = safe_id(pointer_data["derived_id"])
        manifest_path = _safe(root, "data", "derived", aid, did, "manifest.json")
        if checksum(manifest_path) != pointer_data["manifest_sha256"]:
            raise ValueError("Derived manifest integrity failure")
        return _load(root, aid, did, verify=verify)
    except (KeyError, TypeError, OSError) as exc:
        raise ValueError("Invalid derived output") from exc


def derived_artifact_path(root: Path, analysis_id: str, name: str) -> Path:
    if name not in DERIVED_ARTIFACT_NAMES:
        raise ValueError("Unknown derived artifact")
    manifest = load_derived(root, analysis_id)
    if manifest is None:
        raise FileNotFoundError("No derived analysis")
    return _safe(root, "data", "derived", analysis_id, manifest["derived_id"], name)


def _summarize(data, valid, transform, crs, threshold, minimum, synthetic):
    pixel_area = abs(transform.a * transform.e - transform.b * transform.d)
    if not np.isfinite(pixel_area) or pixel_area <= 0:
        raise ValueError("Invalid pixel area")
    total = data.size
    n = int(valid.sum())
    stats = {
        "total_pixels": total,
        "valid_pixels": n,
        "invalid_pixels": total - n,
        "pixel_area_m2": pixel_area,
        "discarded_pixels": 0,
        "discarded_components": 0,
        "classification": "radar_backscatter_change",
        "validation_status": "not_validated",
    }
    features = []
    retained_masks = {}
    for kind, mask in [
        ("increase", valid & (data >= threshold)),
        ("decrease", valid & (data <= -threshold)),
    ]:
        components, count = label(mask)
        sizes = np.bincount(components.ravel(), minlength=count + 1)
        keep = sizes >= minimum
        keep[0] = False
        retained = keep[components]
        retained_masks[kind] = retained
        kept = int(retained.sum())
        stats[f"raw_{kind}_pixels"] = int(mask.sum())
        stats[f"{kind}_pixels"] = kept
        stats[f"{kind}_components"] = int(keep.sum())
        stats[f"discarded_{kind}_pixels"] = int(mask.sum()) - kept
        stats[f"discarded_{kind}_components"] = count - int(keep.sum())
        stats["discarded_pixels"] += stats[f"discarded_{kind}_pixels"]
        stats["discarded_components"] += stats[f"discarded_{kind}_components"]
        for geometry, value in shapes(
            components.astype("int32"), mask=retained, transform=transform, connectivity=4
        ):
            pixels = int(sizes[int(value)])
            features.append(
                {
                    "type": "Feature",
                    "geometry": transform_geom(crs, "EPSG:4326", geometry),
                    "properties": {
                        "class": f"radar_{kind}",
                        "pixels": pixels,
                        "area_m2": pixels * pixel_area,
                        "area_km2": pixels * pixel_area / 1e6,
                        "synthetic": synthetic,
                        "validated": False,
                    },
                }
            )
    stats["changed_pixels"] = stats["increase_pixels"] + stats["decrease_pixels"]
    stats["unchanged_pixels"] = n - stats["changed_pixels"]
    stats["below_threshold_pixels"] = (
        n - stats["raw_increase_pixels"] - stats["raw_decrease_pixels"]
    )
    for key in list(stats):
        if key.endswith("_pixels"):
            prefix = key[:-7]
            stats[f"{prefix}_area_km2"] = stats[key] * pixel_area / 1e6
            stats[f"{prefix}_percent"] = 100 * stats[key] / n if n else None
    for group, mask in [
        ("all_valid", valid),
        ("increase", retained_masks["increase"]),
        ("decrease", retained_masks["decrease"]),
        ("changed", retained_masks["increase"] | retained_masks["decrease"]),
        ("unchanged", valid & ~(retained_masks["increase"] | retained_masks["decrease"])),
    ]:
        values = data[mask]
        summary = {
            name: float(fn(values)) if values.size else None
            for name, fn in [
                ("mean", np.mean),
                ("median", np.median),
                ("min", np.min),
                ("max", np.max),
            ]
        }
        summary["percentiles"] = {
            str(p): float(np.percentile(values, p)) if values.size else None
            for p in [5, 25, 50, 75, 95]
        }
        stats[f"{group}_delta_db"] = summary
    for metric in ("mean", "median", "min", "max"):
        stats[f"{metric}_delta_db"] = stats["all_valid_delta_db"][metric]
    stats["positive_change_percent"] = stats["increase_percent"]
    stats["negative_change_percent"] = stats["decrease_percent"]
    return stats, features


def derive_analysis(
    root: Path, analysis_id: str, *, threshold_db=3.0, min_component_pixels=9, max_pixels=4_000_000
) -> dict:
    aid = safe_id(analysis_id)
    if isinstance(threshold_db, bool) or not np.isfinite(threshold_db) or threshold_db <= 0:
        raise ValueError("Threshold must be positive and finite")
    for value in (min_component_pixels, max_pixels):
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ValueError("Pixel limits must be positive integers")
    original = _safe(root, "artifacts", aid)
    for name in ("manifest.json", "delta-db.tif"):
        _safe(original, name)
    analysis = verify_artifacts(original)
    parameters = {
        "threshold_db": float(threshold_db),
        "min_component_pixels": min_component_pixels,
        "max_pixels": max_pixels,
        "connectivity": 4,
    }
    manifest = {
        "analysis_id": aid,
        "algorithm": ALGORITHM,
        "parameters": parameters,
        "source_manifest_sha256": checksum(original / "manifest.json"),
        "source_delta_sha256": analysis.artifacts["delta-db.tif"],
    }
    did = _identity(manifest)
    manifest["derived_id"] = did
    parent = _safe(root, "data", "derived", aid)
    target = _safe(parent, did)
    if target.exists():
        result = _load(root, aid, did, verify=True)
        write_json(
            _safe(parent, "current.json"),
            {"derived_id": did, "manifest_sha256": checksum(target / "manifest.json")},
        )
        return result
    with rasterio.open(_safe(original, "delta-db.tif")) as src:
        if not src.crs or not src.crs.is_projected or src.crs.linear_units != "metre":
            raise ValueError("Analysis grid must use a projected metre CRS")
        if src.count != 1 or src.width * src.height > max_pixels:
            raise ValueError("Raster exceeds pixel budget or has multiple bands")
        raster = src.read(1, masked=True)
        data = raster.data
        valid = ~np.ma.getmaskarray(raster) & np.isfinite(data)
        statistics, features = _summarize(
            data,
            valid,
            src.transform,
            src.crs,
            threshold_db,
            min_component_pixels,
            analysis.synthetic,
        )
    parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".deriving-", dir=parent))
    try:
        for name, selection in [
            ("general-change.geojson", features),
            (
                "radar-increase.geojson",
                [f for f in features if f["properties"]["class"] == "radar_increase"],
            ),
            (
                "radar-decrease.geojson",
                [f for f in features if f["properties"]["class"] == "radar_decrease"],
            ),
        ]:
            write_json(staging / name, {"type": "FeatureCollection", "features": selection})
        write_json(staging / "general-statistics.json", statistics)
        evidence = {
            "synthetic": analysis.synthetic,
            "sources": analysis.evidence.sources,
            "source_scenes": [s.model_dump(mode="json") for s in analysis.scenes],
            "source_provenance": analysis.provenance,
            "parameters": parameters,
            "source_manifest_sha256": manifest["source_manifest_sha256"],
            "source_delta_sha256": manifest["source_delta_sha256"],
            "observation": "Radar signal increases and decreases; no land-cover or flood truth inferred.",
            "limitations": [
                "Uncalibrated thresholds",
                "Small connected components discarded",
                "No spatial validation",
            ],
            "validated": False,
            "is_operational_alert": False,
        }
        write_json(staging / "general-evidence.json", evidence)
        manifest.update(
            generated_at=datetime.now(UTC).isoformat(),
            statistics=statistics,
            artifacts={p.name: checksum(p) for p in sorted(staging.iterdir())},
        )
        write_json(staging / "manifest.json", manifest)
        staging.chmod(0o755)
        os.rename(staging, target)
        write_json(
            _safe(parent, "current.json"),
            {"derived_id": did, "manifest_sha256": checksum(target / "manifest.json")},
        )
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return manifest
