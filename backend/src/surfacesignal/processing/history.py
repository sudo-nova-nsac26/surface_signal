"""Resumable local NISAR history. Catalog planning never downloads HDF5."""

import hashlib
import json
import math
import os
import shutil
from collections import defaultdict
from contextlib import contextmanager
from datetime import UTC, date, datetime, time
from functools import partial
from pathlib import Path

from shapely.geometry import shape

from surfacesignal import __version__
from surfacesignal.domain import AreaConfig, CatalogSnapshot, comparable
from surfacesignal.processing.gcov import DIAGONALS, ROOT, inspect_gcov, verify_scene
from surfacesignal.processing.pipeline import (
    ARTIFACT_NAMES,
    ArtifactIntegrityError,
    run_analysis,
    runtime_versions,
    verify_artifacts,
)
from surfacesignal.processing.pipeline import (
    implementation_fingerprint as analysis_implementation_fingerprint,
)
from surfacesignal.providers import asf
from surfacesignal.providers.hydro import HydroRecord, context_for
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


def _plan_archive(directory, plan_id):
    return directory / "plans" / (safe_id(plan_id) + ".json")


def _archive_plan(directory, plan):
    path = _plan_archive(directory, plan["plan_id"])
    if path.exists():
        if read_json(path) != plan:
            raise ValueError("Archived history plan failed integrity check; preserve it for review")
    else:
        write_json(path, plan)


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
        or params["delta_threshold"] >= 0
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
        "analysis_implementation_sha256": analysis_implementation_fingerprint(),
        "runtime_versions": runtime_versions(),
        "package_version": __version__,
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
            _archive_plan(directory, previous)
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
    _archive_plan(directory, plan)
    write_json(plan_path, plan)
    return plan


def disk_budget(
    settings, total_bytes, remaining_bytes, *, pending_pairs, total_pairs, reclaimable_bytes=0
):
    reserve = (
        max(
            512 * 1024 * 1024,
            math.ceil(
                total_bytes
                * (180_000_000_000 / 131_386_572_800 - 1)
                * pending_pairs
                / max(1, total_pairs)
            ),
        )
        if pending_pairs
        else 0
    )
    raw_slack = 512 * 1024 * 1024 if remaining_bytes else 0
    volumes = {}
    for label, path, need in (
        ("raw", settings.root / "data/raw", max(0, remaining_bytes - reclaimable_bytes)),
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
            volume["required_bytes"] += raw_slack
        elif "raw" in volume["paths"]:
            volume["required_bytes"] += max(0, raw_slack - reserve)
        volume["sufficient"] = volume["free_bytes"] >= volume["required_bytes"]
    return {
        "volumes": list(volumes.values()),
        "reserve_bytes": reserve,
        "reclaimable_partial_bytes": reclaimable_bytes,
        "pending_pairs": pending_pairs,
        "sufficient": all(v["sufficient"] for v in volumes.values()),
    }


@contextmanager
def history_lock(settings, area_id):
    directory = history_directory(settings, area_id)
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / "history.lock").open("a+b") as lock:
        if os.name == "nt":
            import msvcrt

            if lock.tell() == 0:
                lock.write(b"0")
                lock.flush()
            lock.seek(0)
            acquire = partial(msvcrt.locking, lock.fileno(), msvcrt.LK_NBLCK, 1)
            release = partial(msvcrt.locking, lock.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            acquire = partial(fcntl.flock, lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            release = partial(fcntl.flock, lock.fileno(), fcntl.LOCK_UN)
        try:
            acquire()
        except OSError:
            raise ValueError(
                "History already running for this area/work directory; wait for it to finish"
            ) from None
        try:
            yield
        finally:
            if os.name == "nt":
                lock.seek(0)
            release()


def raw_inventory(settings, plan, *, recover=False):
    records = []
    for scene in CatalogSnapshot.model_validate(plan["catalog"]).scenes:
        target, receipt, _ = asf.raw_paths(scene, settings.root / "data/raw")
        record = {
            "scene_id": scene.scene_id,
            "collection": scene.metadata.get("collection", "unknown"),
            "source_url": scene.url,
            "synthetic": scene.synthetic,
            "mandatory": scene.scene_id in plan["mandatory_ids"],
            "size_bytes": scene.size_bytes,
            "path": str(target.relative_to(settings.root)),
            "receipt_path": str(receipt.relative_to(settings.root)),
            "status": "pending",
        }
        if scene.size_bytes is None:
            record.update(
                status="unknown_size",
                reason="Catalog bytes unknown; refresh metadata before download",
            )
        else:
            try:
                record["receipt"] = asf.verify_download(scene, target.parent, recover=recover)
                record.update(status="verified", receipt_sha256=checksum(receipt))
            except FileNotFoundError:
                record["reason"] = "Raw HDF5 is not yet downloaded"
            except (ValueError, OSError):
                record.update(
                    status="needs_review",
                    reason="Existing raw/receipt failed integrity check; preserve original and move it aside for review before rerunning",
                )
        records.append(record)
    return records


def planning_summary(settings, plan, *, inventory=None):
    scenes = CatalogSnapshot.model_validate(plan["catalog"]).scenes
    inventory = raw_inventory(settings, plan) if inventory is None else inventory
    total = sum(s.size_bytes or 0 for s in scenes)
    remaining = sum(s["size_bytes"] or 0 for s in inventory if s["status"] != "verified")
    lookup = {r["scene_id"]: r for r in inventory}
    reclaimable = sum(
        asf.partial_size(s, settings.root / "data/raw")
        for s in scenes
        if lookup[s.scene_id]["status"] == "pending"
    )
    pending_pairs = _pending_pair_count(settings, plan, lookup)
    return {
        "area_id": plan["area_id"],
        "plan_id": plan["plan_id"],
        "scene_count": len(scenes),
        "mandatory_scene_count": len(plan["mandatory_ids"]),
        "candidate_pairs": len(plan["pairs"]),
        "catalog": [
            {
                "scene_id": s.scene_id,
                "start_time": s.start_time.isoformat(),
                "collection": s.metadata.get("collection", "unknown"),
                "size_bytes": s.size_bytes,
                "mandatory": s.scene_id in plan["mandatory_ids"],
                "synthetic": s.synthetic,
            }
            for s in scenes
        ],
        "parameters": plan["parameters"],
        "pairs": plan["pairs"],
        "groups": plan["groups"],
        "total_bytes": total,
        "additional_bytes": sum(
            s.size_bytes or 0 for s in scenes if s.scene_id not in plan["mandatory_ids"]
        ),
        "remaining_bytes": remaining,
        "unknown_size_ids": [s.scene_id for s in scenes if s.size_bytes is None],
        "scenes": inventory,
        "disk": disk_budget(
            settings,
            total,
            remaining,
            pending_pairs=pending_pairs,
            total_pairs=len(plan["pairs"]),
            reclaimable_bytes=reclaimable,
        ),
        "expected_artifacts": sorted(ARTIFACT_NAMES),
        "output_directory": str(settings.artifacts_dir / "<analysis_id>"),
    }


def download_history(settings, plan, *, download_fn=None, progress=None, state_callback=None):
    """Download one copy per ID. The caller holds history_lock through processing."""
    scenes = {s.scene_id: s for s in CatalogSnapshot.model_validate(plan["catalog"]).scenes}
    records = raw_inventory(settings, plan, recover=True)
    summary = planning_summary(settings, plan, inventory=records)
    result = {
        "scenes": records,
        "disk": summary["disk"],
        "downloads_complete": False,
        "error": None,
    }

    def checkpoint():
        result["downloads_complete"] = all(s["status"] == "verified" for s in records)
        if state_callback:
            state_callback(result)

    checkpoint()
    if not summary["disk"]["sufficient"]:
        result["error"] = (
            "Insufficient disk space for all remaining HDF5 plus output/temp reserve; free space on the listed volumes and rerun"
        )
        checkpoint()
        return result
    try:
        for index, record in enumerate(records, 1):
            if record["status"] != "pending":
                continue
            scene = scenes[record["scene_id"]]
            if progress:
                progress(
                    {
                        "event": "start",
                        "file": index,
                        "files": len(records),
                        "scene_id": scene.scene_id,
                        "bytes": 0,
                        "total_bytes": scene.size_bytes,
                    }
                )

            def file_progress(count, total, *, index=index, scene=scene):
                if progress:
                    progress(
                        {
                            "event": "bytes",
                            "file": index,
                            "files": len(records),
                            "scene_id": scene.scene_id,
                            "bytes": count,
                            "total_bytes": total,
                        }
                    )

            try:
                (download_fn or asf.download)(
                    scene,
                    settings.root / "data/raw",
                    scene.size_bytes / 1_000_000_000 + 1e-9,
                    progress=file_progress,
                )
                receipt = asf.verify_download(scene, settings.root / "data/raw", recover=True)
                record.update(
                    status="verified",
                    receipt=receipt,
                    receipt_sha256=checksum(settings.root / record["receipt_path"]),
                )
                record.pop("reason", None)
                if progress:
                    progress(
                        {
                            "event": "verified",
                            "file": index,
                            "files": len(records),
                            "scene_id": scene.scene_id,
                            "bytes": scene.size_bytes,
                            "total_bytes": scene.size_bytes,
                        }
                    )
            except (ValueError, OSError, asf.ProviderError) as exc:
                message = (
                    str(exc)
                    if type(exc) in (ValueError, asf.ProviderError)
                    else "Local file I/O failed; check disk and permissions, then rerun"
                )
                record.update(status="failed", reason=message)
                result["error"] = message
                break
            finally:
                checkpoint()
    finally:
        checkpoint()
    return result


def _inspect_inputs(settings, plan, records):
    scenes = {s.scene_id: s for s in CatalogSnapshot.model_validate(plan["catalog"]).scenes}
    for record in records:
        if record["status"] != "verified":
            continue
        path = settings.root / record["path"]
        try:
            verify_scene(path, scenes[record["scene_id"]])
            inspected = inspect_gcov(path)
            dataset = inspected["datasets"].get(
                f"{ROOT}/frequency{plan['parameters']['frequency']}/{plan['parameters']['channel']}"
            )
            if dataset is None:
                raise ValueError("Requested frequency/channel unavailable in HDF5")
            if len(dataset["shape"]) != 2 or dataset["dtype_kind"] not in ("f", "i", "u"):
                raise ValueError("Covariance channel is not real two-dimensional power")
            inspected.update(
                scene_id=record["scene_id"],
                source_url=record["source_url"],
                input_sha256=record["receipt"]["sha256"],
                parameters=plan["parameters"],
            )
            inspection_path = (
                history_directory(settings, plan["area_id"])
                / "inspections"
                / plan["plan_id"]
                / (safe_id(record["scene_id"]) + ".json")
            )
            write_json(inspection_path, inspected)
            record["inspection"] = {
                "status": "compatible",
                "path": str(inspection_path.relative_to(settings.root)),
                "sha256": checksum(inspection_path),
                "selected_dataset": dataset,
            }
        except (ValueError, KeyError) as exc:
            record["inspection"] = {
                "status": "blocked",
                "reason": str(exc)
                if type(exc) is ValueError
                else "Required GCOV identification/grid metadata missing",
            }
        except OSError:
            record["inspection"] = {
                "status": "failed",
                "reason": "Cannot inspect local HDF5; check file accessibility and rerun",
            }


def _pair_identity(plan, pair, inventory):
    scenes = {s.scene_id: s for s in CatalogSnapshot.model_validate(plan["catalog"]).scenes}
    selected = [scenes[pair[k]] for k in ("before", "after")]
    inputs = [inventory[s.scene_id]["receipt"]["sha256"] for s in selected]
    context = context_for(
        [HydroRecord.model_validate(r) for r in plan["hydrology"]["records"]],
        selected[1].start_time,
    )
    identity = {
        "scenes": [s.model_dump(mode="json") for s in selected],
        "input_sha256": inputs,
        "parameters": plan["parameters"],
        "area": plan["area"],
        "hydrological_context": context,
        "implementation_sha256": plan["request"]["analysis_implementation_sha256"],
        "package_version": plan["request"]["package_version"],
        "versions": plan["request"]["runtime_versions"],
    }
    return fingerprint(identity), identity


def _verify_pair_result(settings, plan, pair, inventory, record):
    key, identity = _pair_identity(plan, pair, inventory)
    if (
        record.get("pair_key") != key
        or record.get("status") != "completed"
        or any(record.get(k) != pair[k] for k in ("before", "after"))
        or record.get("input_sha256") != identity["input_sha256"]
    ):
        raise ArtifactIntegrityError("Saved pair identity failed integrity check")
    identifier = safe_id(record["analysis_id"])
    analysis = verify_artifacts(
        settings.artifacts_dir / identifier, manifest_sha256=record["manifest_sha256"]
    )
    if (
        analysis.parameters != identity["parameters"]
        or [s.model_dump(mode="json") for s in analysis.scenes] != identity["scenes"]
        or any(
            analysis.provenance.get(k) != identity[k]
            for k in (
                "area",
                "input_sha256",
                "hydrological_context",
                "implementation_sha256",
                "package_version",
                "versions",
            )
        )
    ):
        raise ArtifactIntegrityError(
            "Saved manifest does not match requested scenes, parameters or provenance"
        )
    return analysis


def _pending_pair_count(settings, plan, inventory):
    directory = history_directory(settings, plan["area_id"])
    try:
        previous = read_json(directory / "report.json")
        blocked = {
            (p["before"], p["after"]): p for p in previous["pairs"] if p["status"] == "blocked"
        }
    except (ValueError, OSError, KeyError, TypeError):
        blocked = {}
    pending = 0
    for pair in plan["pairs"]:
        if any(inventory[pair[k]]["status"] != "verified" for k in ("before", "after")):
            pending += 1
            continue
        key, _ = _pair_identity(plan, pair, inventory)
        cache_path = directory / "pairs" / (key + ".json")
        try:
            if cache_path.exists():
                _verify_pair_result(settings, plan, pair, inventory, read_json(cache_path))
                continue
            previous = blocked.get((pair["before"], pair["after"]), {})
            if (
                previous.get("pair_key") == key
                and previous.get("reason")
                and previous.get("reason_code")
                in ("file_incompatible", "incompatible_input_or_coverage")
            ):
                continue
        except (ValueError, OSError, KeyError, TypeError):
            pass
        pending += 1
    return pending


def _process_pairs(
    settings, plan, records, pairs, *, analyze_fn=None, checkpoint=None, progress=None
):
    inventory = {r["scene_id"]: r for r in records}
    scenes = {s.scene_id: s for s in CatalogSnapshot.model_validate(plan["catalog"]).scenes}
    area = AreaConfig.model_validate(plan["area"])
    hydro = [HydroRecord.model_validate(r) for r in plan["hydrology"]["records"]]
    _inspect_inputs(settings, plan, records)
    if checkpoint:
        checkpoint()
    for index, result in enumerate(pairs):
        result.pop("reason", None)
        pair = plan["pairs"][index]
        inputs = [inventory[pair[k]] for k in ("before", "after")]
        if any(r["status"] != "verified" for r in inputs):
            result.update(
                status="pending",
                reason="Required raw HDF5 is not verified; resolve scene status and rerun",
            )
            continue
        key, identity = _pair_identity(plan, pair, inventory)
        result.update(pair_key=key, input_sha256=identity["input_sha256"])
        blocked = next((r for r in inputs if r["inspection"]["status"] != "compatible"), None)
        if blocked:
            result.update(
                status=blocked["inspection"]["status"],
                reason=blocked["inspection"]["reason"],
                reason_code="file_incompatible"
                if blocked["inspection"]["status"] == "blocked"
                else "inspection_failed",
            )
            if checkpoint:
                checkpoint()
            continue
        cache_path = history_directory(settings, plan["area_id"]) / "pairs" / (key + ".json")
        try:
            if cache_path.exists():
                try:
                    cached = read_json(cache_path)
                    target = settings.artifacts_dir / safe_id(cached["analysis_id"])
                    # A removed target can be rebuilt from the retained raw inputs.
                    # An existing target must pass its saved manifest hash: never re-anchor it.
                    if target.exists() or target.is_symlink():
                        _verify_pair_result(settings, plan, pair, inventory, cached)
                        result.update(cached | {"reused": True})
                        continue
                except (ValueError, OSError, KeyError, TypeError):
                    raise ArtifactIntegrityError(
                        "Saved pair/manifest failed integrity check; preserve the damaged artifact directory outside artifacts (or the malformed pair cache for review), then rerun"
                    ) from None
            before, after = (scenes[pair[k]] for k in ("before", "after"))
            analysis = (analyze_fn or run_analysis)(
                settings.root / inputs[0]["path"],
                settings.root / inputs[1]["path"],
                before,
                after,
                area,
                settings.artifacts_dir,
                **plan["parameters"],
                hydro_records=hydro,
                verified_input_sha256=identity["input_sha256"],
            )
            result.update(
                status="completed",
                analysis_id=analysis.analysis_id,
                manifest_sha256=checksum(
                    settings.artifacts_dir / analysis.analysis_id / "manifest.json"
                ),
                reused=False,
            )
            _verify_pair_result(settings, plan, pair, inventory, result)
            write_json(cache_path, result)
        except ArtifactIntegrityError as exc:
            result.update(status="failed", reason=str(exc), reason_code="artifact_integrity")
        except (ValueError, KeyError) as exc:
            result.update(
                status="blocked",
                reason=str(exc)
                if type(exc) is ValueError
                else "Required GCOV grid metadata missing",
                reason_code="incompatible_input_or_coverage",
            )
        except OSError:
            result.update(
                status="failed",
                reason="Local analysis I/O failed; check output disk/permissions and rerun",
                reason_code="local_io",
            )
        finally:
            if progress:
                progress(
                    {
                        "event": "pair",
                        "pair": index + 1,
                        "pairs": len(pairs),
                        "status": result["status"],
                    }
                )
            if checkpoint:
                checkpoint()


def collection_summary(plan, records):
    collections = {}
    inventory = {r["scene_id"]: r for r in records}
    for scene in CatalogSnapshot.model_validate(plan["catalog"]).scenes:
        record = inventory[scene.scene_id]
        summary = collections.setdefault(
            scene.metadata.get("collection", "unknown"),
            {
                "scene_count": 0,
                "mandatory_count": 0,
                "known_bytes": 0,
                "unknown_size_count": 0,
                "verified_count": 0,
                "verified_bytes": 0,
            },
        )
        summary["scene_count"] += 1
        summary["mandatory_count"] += int(scene.scene_id in plan["mandatory_ids"])
        summary["known_bytes"] += scene.size_bytes or 0
        summary["unknown_size_count"] += int(scene.size_bytes is None)
        if record["status"] == "verified":
            summary["verified_count"] += 1
            summary["verified_bytes"] += scene.size_bytes or 0
    return collections


def _report(settings, plan, downloads, pairs):
    records = downloads["scenes"]
    complete_downloads = bool(records) and all(r["status"] == "verified" for r in records)
    completed = (
        complete_downloads
        and not downloads["error"]
        and all(p["status"] in ("completed", "blocked") for p in pairs)
    )
    return {
        "schema_version": 1,
        "updated_at": datetime.now(UTC).isoformat(),
        "area_id": plan["area_id"],
        "plan_id": plan["plan_id"],
        "plan_path": str(
            _plan_archive(
                history_directory(settings, plan["area_id"]), plan["plan_id"]
            ).relative_to(settings.root)
        ),
        "plan_sha256": checksum(
            _plan_archive(history_directory(settings, plan["area_id"]), plan["plan_id"])
        ),
        "snapshot": plan["snapshot"],
        "parameters": plan["parameters"],
        "validated_query": plan["validated_query"],
        "groups": plan["groups"],
        "collections": collection_summary(plan, records),
        "scenes": records,
        "scene_counts": {
            status: sum(r["status"] == status for r in records)
            for status in ("verified", "pending", "unknown_size", "needs_review", "failed")
        },
        "pairs": pairs,
        "pair_counts": {
            status: sum(r["status"] == status for r in pairs)
            for status in ("completed", "blocked", "pending", "failed")
        },
        "downloads_complete": complete_downloads,
        "completed": completed,
        "disk": downloads["disk"],
        "error": downloads["error"],
        "validation_status": "not_validated",
        "interpretation": "Exploratory open-water change candidates; no independent spatial validation; not confirmed flooding",
        "report_path": str(
            (history_directory(settings, plan["area_id"]) / "report.json").relative_to(
                settings.root
            )
        ),
    }


def run_history(
    settings,
    snapshot_path,
    *,
    validated_through=None,
    parameters=None,
    hydro_csv=None,
    dry_run=False,
    progress=None,
    download_fn=None,
    analyze_fn=None,
):
    if download_fn is None and settings.earthdata_token:
        download_fn = partial(asf.download, token=settings.earthdata_token.get_secret_value())
    snapshot = CatalogSnapshot.model_validate(read_json(snapshot_path))
    with history_lock(settings, snapshot.area_id):
        plan = plan_history(
            settings,
            snapshot_path,
            validated_through=validated_through,
            parameters=parameters,
            hydro_csv=hydro_csv,
        )
        if dry_run:
            return planning_summary(settings, plan)
        write_json(settings.catalog_dir / (safe_id(plan["area_id"]) + ".json"), plan["catalog"])
        pairs = [
            pair | {"status": "pending", "reason": "Processing not yet attempted"}
            for pair in plan["pairs"]
        ]
        directory = history_directory(settings, plan["area_id"])

        def save_downloads(downloads):
            report = _report(settings, plan, downloads, pairs)
            write_json(directory / "reports" / (plan["plan_id"] + ".json"), report)
            write_json(directory / "report.json", report)

        downloads = download_history(
            settings,
            plan,
            download_fn=download_fn,
            progress=progress,
            state_callback=save_downloads,
        )

        def checkpoint():
            save_downloads(downloads)

        try:
            if not downloads["error"]:
                _process_pairs(
                    settings,
                    plan,
                    downloads["scenes"],
                    pairs,
                    analyze_fn=analyze_fn,
                    checkpoint=checkpoint,
                    progress=progress,
                )
        finally:
            checkpoint()
        return read_json(directory / "report.json")


def verify_history(settings, area_id):
    """Verify the recorded local batch without consulting a provider or rerunning science."""
    errors = []
    directory = history_directory(settings, area_id)
    try:
        with history_lock(settings, area_id):
            report = read_json(directory / "report.json")
            plan_path = _plan_archive(directory, report["plan_id"])
            plan = read_json(plan_path)
            if (
                plan["plan_id"] != fingerprint({k: v for k, v in plan.items() if k != "plan_id"})
                or report.get("plan_path") != str(plan_path.relative_to(settings.root))
                or report["plan_sha256"] != checksum(plan_path)
                or report["plan_id"] != plan["plan_id"]
            ):
                raise ValueError("Plan/report identity or hash mismatch")
            catalog = CatalogSnapshot.model_validate(plan["catalog"])
            snapshot = CatalogSnapshot.model_validate(plan["snapshot"]["catalog"])
            expected_pairs, expected_groups = candidate_pairs(catalog.scenes)
            expected_ids = [s.scene_id for s in catalog.scenes]
            if (
                catalog.area_id != area_id
                or plan["area_id"] != area_id
                or report["area_id"] != area_id
                or any(s.area_id != area_id for s in catalog.scenes)
            ):
                raise ValueError("History area mismatch")
            if (
                len(expected_ids) != len(set(expected_ids))
                or set(plan["mandatory_ids"]) != {s.scene_id for s in snapshot.scenes}
                or not set(plan["mandatory_ids"]) <= set(expected_ids)
            ):
                raise ValueError("Mandatory/catalog inventory mismatch")
            if (
                plan["pairs"] != expected_pairs
                or plan["groups"] != expected_groups
                or report["groups"] != expected_groups
                or report["parameters"] != plan["parameters"]
                or report["snapshot"] != plan["snapshot"]
            ):
                raise ValueError("Plan/report specification mismatch")
            if [r["scene_id"] for r in report["scenes"]] != expected_ids or [
                {k: p[k] for k in ("before", "after")} for p in report["pairs"]
            ] != expected_pairs:
                raise ValueError("Report omitted or duplicated required scenes/pairs")
            records = raw_inventory(settings, plan)
            inventory = {r["scene_id"]: r for r in records}
            for recorded, actual in zip(report["scenes"], records, strict=True):
                if actual["status"] != "verified":
                    errors.append(f"{actual['scene_id']}: raw/receipt {actual['status']}")
                    continue
                if (
                    recorded.get("status") != "verified"
                    or recorded.get("receipt") != actual["receipt"]
                    or recorded.get("receipt_sha256") != actual["receipt_sha256"]
                    or any(
                        recorded.get(k) != actual[k]
                        for k in (
                            "path",
                            "receipt_path",
                            "source_url",
                            "collection",
                            "mandatory",
                            "synthetic",
                            "size_bytes",
                        )
                    )
                ):
                    errors.append(f"{actual['scene_id']}: recorded receipt differs")
                inspection = recorded.get("inspection", {})
                if inspection.get("status") == "compatible":
                    expected_path = (
                        directory
                        / "inspections"
                        / plan["plan_id"]
                        / (safe_id(actual["scene_id"]) + ".json")
                    )
                    if (
                        not expected_path.is_file()
                        or expected_path.is_symlink()
                        or inspection.get("path") != str(expected_path.relative_to(settings.root))
                        or checksum(expected_path) != inspection.get("sha256")
                    ):
                        errors.append(f"{actual['scene_id']}: inspection integrity failed")
            for pair, recorded in zip(expected_pairs, report["pairs"], strict=True):
                label = f"{pair['before']} -> {pair['after']}"
                if any(inventory[pair[k]]["status"] != "verified" for k in ("before", "after")):
                    errors.append(f"{label}: unverified inputs")
                    continue
                try:
                    if recorded["status"] == "completed":
                        _verify_pair_result(settings, plan, pair, inventory, recorded)
                    elif recorded["status"] == "blocked":
                        key, _ = _pair_identity(plan, pair, inventory)
                        if (
                            not recorded.get("reason")
                            or recorded.get("pair_key") != key
                            or recorded.get("reason_code")
                            not in ("file_incompatible", "incompatible_input_or_coverage")
                        ):
                            raise ValueError("Invalid blocked pair record")
                    else:
                        errors.append(f"{label}: {recorded['status']}; rerun history")
                except (ValueError, OSError, KeyError, TypeError):
                    errors.append(f"{label}: analysis/manifest integrity failed")
            if report["collections"] != collection_summary(plan, records):
                errors.append("Collection totals differ from verified inventory")
            if report.get("downloads_complete") != all(r["status"] == "verified" for r in records):
                errors.append("Download completion flag differs from verified inventory")
            if report.get("scene_counts") != {
                status: sum(r["status"] == status for r in records)
                for status in ("verified", "pending", "unknown_size", "needs_review", "failed")
            }:
                errors.append("Scene counts differ from verified inventory")
            if report.get("pair_counts") != {
                status: sum(p["status"] == status for p in report["pairs"])
                for status in ("completed", "blocked", "pending", "failed")
            }:
                errors.append("Pair counts differ from verified inventory")
            expected_complete = (
                all(r["status"] == "verified" for r in records)
                and all(p["status"] in ("completed", "blocked") for p in report["pairs"])
                and not report.get("error")
            )
            if report["completed"] != expected_complete or not report["completed"]:
                errors.append("Batch is incomplete; resolve recorded reasons and rerun history")
            return {
                "verified": not errors,
                "completed": report["completed"] and not errors,
                "area_id": area_id,
                "scene_count": len(records),
                "pair_count": len(expected_pairs),
                "errors": errors,
            }
    except (ValueError, OSError, KeyError, TypeError):
        return {
            "verified": False,
            "completed": False,
            "area_id": area_id,
            "errors": [
                "Local plan/report unavailable, inconsistent or locked; inspect the history files and rerun history"
            ],
        }
