"""Resumable local NISAR history. Catalog planning never downloads HDF5."""

import hashlib
import json
import math
import shutil
from collections import defaultdict
from datetime import UTC, date, datetime, time
from pathlib import Path

from shapely.geometry import shape

from surfacesignal.domain import CatalogSnapshot, comparable
from surfacesignal.processing.gcov import DIAGONALS
from surfacesignal.processing.pipeline import ARTIFACT_NAMES
from surfacesignal.providers import asf
from surfacesignal.storage import checksum, read_json, safe_id, write_json

VALIDATED_COLLECTION = "NISAR_L2_GCOV_V1"
PROVISIONAL_COLLECTION = "NISAR_L2_GCOV_PROVISIONAL_V1"
GROUP_FIELDS = (
    "area_id",
    "track",
    "frame",
    "direction",
    "mode",
    "polarization",
    "release",
    "maturity",
)
DEFAULT_PARAMETERS = {
    "frequency": "A",
    "channel": "HHHH",
    "delta_threshold": -3.0,
    "water_threshold": -17.0,
    "min_component_pixels": 9,
    "edge_pixels": 1,
    "min_looks": 1.0,
}


def fingerprint(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def implementation_fingerprint() -> str:
    package = Path(__file__).resolve().parents[1]
    names = (
        "domain.py",
        "processing/gcov.py",
        "processing/change.py",
        "processing/pipeline.py",
        "providers/hydro.py",
        "processing/history.py",
    )
    return fingerprint({name: checksum(package / name) for name in names})


def history_directory(settings, area_id):
    return settings.root / "data/history" / safe_id(area_id)


def candidate_pairs(scenes):
    grouped = defaultdict(list)
    for scene in scenes:
        grouped[tuple(getattr(scene, key) for key in GROUP_FIELDS)].append(scene)
    pairs, groups = [], []
    for key, members in sorted(grouped.items(), key=lambda item: str(item[0])):
        members.sort(key=lambda s: (s.start_time, s.scene_id))
        # Several releases of one acquisition stay in inventory; never compare versions.
        acquisitions = {}
        for scene in members:
            acquisitions.setdefault(scene.start_time, scene)
        ordered = list(acquisitions.values())
        complete_metadata = all(value is not None for value in key)
        eligible = [
            {"before": before.scene_id, "after": after.scene_id}
            for before, after in zip(ordered, ordered[1:], strict=False)
            if complete_metadata and comparable(before, after)
        ]
        pairs.extend(eligible)
        groups.append(
            {
                "metadata": dict(zip(GROUP_FIELDS, key, strict=True)),
                "scene_ids": [s.scene_id for s in members],
                "acquisition_representatives": [s.scene_id for s in ordered],
                "status": "paired" if eligible else "no_pair",
                "reason": None
                if eligible
                else "Incomplete compatibility metadata"
                if not complete_metadata
                else "Fewer than two distinct acquisitions",
            }
        )
    return pairs, groups


def plan_history(
    settings,
    snapshot_path,
    *,
    validated_through: date | None = None,
    parameters=None,
    hydro_csv=None,
    search_fn=None,
):
    from surfacesignal.main import load_areas

    snapshot_path = Path(snapshot_path)
    snapshot = CatalogSnapshot.model_validate(read_json(snapshot_path))
    safe_id(snapshot.area_id)
    if not snapshot.complete or not snapshot.scenes:
        raise ValueError("History requires a complete nonempty snapshot")
    if any(s.area_id != snapshot.area_id for s in snapshot.scenes):
        raise ValueError("Snapshot scene area mismatch")
    area = next((a for a in load_areas(settings) if a.area_id == snapshot.area_id), None)
    if area is None:
        raise ValueError("Snapshot area not found in configuration")
    params = DEFAULT_PARAMETERS | (parameters or {})
    if set(params) != set(DEFAULT_PARAMETERS):
        raise ValueError("Unknown history processing parameter")
    if params["frequency"] not in ("A", "B") or params["channel"] not in DIAGONALS:
        raise ValueError("History requires frequency A/B and a real diagonal channel")
    if (
        any(
            not math.isfinite(params[k])
            for k in ("delta_threshold", "water_threshold", "min_looks")
        )
        or params["min_looks"] < 0
        or params["min_component_pixels"] < 1
        or params["edge_pixels"] < 0
    ):
        raise ValueError("Invalid history thresholds or pixel parameters")
    from surfacesignal.providers.hydro import read_records

    hydro_records = (
        [r.model_dump(mode="json") for r in read_records(hydro_csv)] if hydro_csv else []
    )
    request = {
        "snapshot_sha256": checksum(snapshot_path),
        "area": area.model_dump(mode="json"),
        "validated_through": validated_through.isoformat() if validated_through else None,
        "parameters": params,
        "hydro_sha256": checksum(hydro_csv) if hydro_csv else None,
        "implementation_sha256": implementation_fingerprint(),
    }
    directory = history_directory(settings, snapshot.area_id)
    plan_path = directory / "plan.json"
    if plan_path.exists():
        previous = read_json(plan_path)
        if previous.get("request") == request:
            if previous.get("plan_id") != fingerprint(
                {k: v for k, v in previous.items() if k != "plan_id"}
            ):
                raise ValueError("History plan failed integrity check; preserve it for review")
            return previous
    resolved = {}
    for scene in snapshot.scenes:
        scene = scene.model_copy(deep=True)
        scene.metadata.setdefault(
            "collection",
            snapshot.query.get("shortName")
            or (PROVISIONAL_COLLECTION if scene.maturity == "PROVISIONAL" else "unknown"),
        )
        if scene.scene_id in resolved and resolved[scene.scene_id] != scene:
            raise ValueError("Conflicting duplicate scene ID in snapshot")
        resolved[scene.scene_id] = scene
    mandatory = list(resolved)
    query = None
    if validated_through:
        start = datetime.fromisoformat(
            snapshot.query.get("start") or min(s.start_time for s in snapshot.scenes).isoformat()
        )
        start = start.replace(tzinfo=UTC) if start.tzinfo is None else start.astimezone(UTC)
        end = datetime.combine(validated_through, time.max, tzinfo=UTC)
        if end < start:
            raise ValueError("Validated-through date precedes snapshot start")
        query = {
            "shortName": VALIDATED_COLLECTION,
            "start": start.isoformat().replace("+00:00", "Z"),
            "end": end.isoformat().replace("+00:00", "Z"),
            "geometry": area.geometry,
        }
        found = (search_fn or asf.search)(
            shape(area.geometry).wkt,
            query["start"],
            query["end"],
            snapshot.area_id,
            short_name=VALIDATED_COLLECTION,
        )
        for scene in found:
            if scene.area_id != snapshot.area_id:
                raise ValueError("Validated scene area mismatch")
            if start <= scene.start_time <= end and scene.scene_id not in resolved:
                scene = scene.model_copy(deep=True)
                scene.metadata["collection"] = VALIDATED_COLLECTION
                resolved[scene.scene_id] = scene
        query["accessed_at"] = datetime.now(UTC).isoformat()
    scenes = sorted(resolved.values(), key=lambda s: (s.start_time, s.scene_id))
    pairs, groups = candidate_pairs(scenes)
    plan = {
        "schema_version": 1,
        "created_at": datetime.now(UTC).isoformat(),
        "area_id": snapshot.area_id,
        "area": request["area"],
        "request": request,
        "snapshot": {
            "path": str(snapshot_path),
            "sha256": request["snapshot_sha256"],
            "catalog": snapshot.model_dump(mode="json"),
        },
        "mandatory_ids": mandatory,
        "validated_query": query,
        "catalog": CatalogSnapshot(
            area_id=snapshot.area_id,
            scenes=scenes,
            accessed_at=datetime.now(UTC),
            query={"snapshot_sha256": request["snapshot_sha256"], "validated_query": query},
        ).model_dump(mode="json"),
        "parameters": params,
        "hydrology": {"sha256": request["hydro_sha256"], "records": hydro_records},
        "groups": groups,
        "pairs": pairs,
    }
    plan["plan_id"] = fingerprint(plan)
    # Search and validation finish before publication: a failed extension leaves the old plan intact.
    write_json(plan_path, plan)
    return plan


def disk_budget(settings, total_bytes, remaining_bytes):
    reserve = max(
        512 * 1024 * 1024, math.ceil(total_bytes * (180_000_000_000 / 131_386_572_800 - 1))
    )
    volumes = {}
    for label, path, need in (
        ("raw", settings.root / "data/raw", remaining_bytes),
        ("artifacts", settings.artifacts_dir, reserve),
    ):
        ancestor = path
        while not ancestor.exists():
            ancestor = ancestor.parent
        device = str(ancestor.stat().st_dev)
        volume = volumes.setdefault(
            device,
            {"paths": [], "free_bytes": shutil.disk_usage(ancestor).free, "required_bytes": 0},
        )
        volume["paths"].append(label)
        volume["required_bytes"] += need
    for volume in volumes.values():
        if volume["paths"] == ["raw"]:
            volume["required_bytes"] += 512 * 1024 * 1024
        volume["sufficient"] = volume["free_bytes"] >= volume["required_bytes"]
    return {
        "volumes": list(volumes.values()),
        "reserve_bytes": reserve,
        "sufficient": all(v["sufficient"] for v in volumes.values()),
    }


def planning_summary(settings, plan):
    scenes = CatalogSnapshot.model_validate(plan["catalog"]).scenes
    total = sum(s.size_bytes or 0 for s in scenes)
    remaining = total
    return {
        "area_id": plan["area_id"],
        "plan_id": plan["plan_id"],
        "scene_count": len(scenes),
        "mandatory_scene_count": len(plan["mandatory_ids"]),
        "candidate_pairs": len(plan["pairs"]),
        "catalog": plan["catalog"],
        "pairs": plan["pairs"],
        "groups": plan["groups"],
        "total_bytes": total,
        "additional_bytes": sum(
            s.size_bytes or 0 for s in scenes if s.scene_id not in plan["mandatory_ids"]
        ),
        "remaining_bytes": remaining,
        "unknown_size_ids": [s.scene_id for s in scenes if s.size_bytes is None],
        "disk": disk_budget(settings, total, remaining),
        "expected_artifacts": sorted(ARTIFACT_NAMES),
        "output_directory": str(settings.artifacts_dir / "<analysis_id>"),
    }
