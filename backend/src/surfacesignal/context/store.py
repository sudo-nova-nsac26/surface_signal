"""Immutable context snapshots with hash-checked, network-free readers."""

import os
import shutil
import tempfile
from pathlib import Path

from surfacesignal.api.service import Repository, StoreUnavailable
from surfacesignal.context.importer import bounded, digest
from surfacesignal.context.models import (
    ContextBudgets,
    ContextValidation,
    EnvironmentalContextReport,
    EnvironmentalEvent,
    ReferenceLayers,
)
from surfacesignal.domain import Page
from surfacesignal.preparation.context import safe_path
from surfacesignal.storage import checksum, read_json, safe_id, write_json

PAYLOAD_MODELS = {
    "environmental-context.json": EnvironmentalContextReport,
    "validation.json": ContextValidation,
    "reference-layers.json": ReferenceLayers,
    "environmental-events.json": Page[EnvironmentalEvent],
}


class ContextNotPrepared(FileNotFoundError):
    pass


class ContextInvalid(StoreUnavailable):
    pass


def _base(settings, area_id, analysis_id):
    return safe_path(settings.root / "data/context" / safe_id(area_id) / safe_id(analysis_id))


def _read(settings, analysis, folder, manifest_sha):
    manifest = read_json(bounded(folder / "manifest.json", 1_000_000))
    identity = manifest["identity"]
    if (
        checksum(folder / "manifest.json") != manifest_sha
        or digest(identity)[:24] != folder.name
        or identity["analysis_id"] != analysis.analysis_id
        or identity["area_id"] != analysis.area_id
    ):
        raise ValueError("Context identity mismatch")
    if (
        checksum(settings.artifacts_dir / analysis.analysis_id / "manifest.json")
        != identity["analysis_sha256"]
        or Repository(settings).area(analysis.area_id).geometry != identity["geometry"]
    ):
        raise ValueError("Context SAR inputs changed; rebuild offline")
    budgets = ContextBudgets.model_validate(identity["budgets"])
    if set(manifest["files"]) != set(PAYLOAD_MODELS) or {p.name for p in folder.iterdir()} != set(
        PAYLOAD_MODELS
    ) | {"manifest.json"}:
        raise ValueError("Incomplete context inventory")
    total = 0
    payloads = {}
    for name, model in PAYLOAD_MODELS.items():
        path = bounded(folder / name, budgets.max_output_bytes)
        total += path.stat().st_size
        if checksum(path) != manifest["files"][name]:
            raise ValueError("Context output integrity failure")
        payloads[name] = model.model_validate(read_json(path)).model_dump(mode="json")
    if total + (folder / "manifest.json").stat().st_size > budgets.max_output_bytes:
        raise ValueError("Context output byte budget exceeded")
    report = payloads["environmental-context.json"]
    if (
        report["analysis_id"] != analysis.analysis_id
        or report["area_id"] != analysis.area_id
        or report["provenance"]["identity"] != identity
        or report["synthetic"] != analysis.synthetic
    ):
        raise ValueError("Context report identity mismatch")
    return {"manifest": manifest, "payloads": payloads}


def load_context(settings, analysis_id):
    analysis = Repository(settings).analysis(analysis_id)
    try:
        base = _base(settings, analysis.area_id, analysis_id)
        pointer = safe_path(base / "current.json")
        if not pointer.exists():
            raise ContextNotPrepared("context_not_prepared")
        value = read_json(bounded(pointer, 4096))
        return _read(
            settings,
            analysis,
            safe_path(base / safe_id(value["context_id"])),
            value["manifest_sha256"],
        )
    except ContextNotPrepared:
        raise
    except (ValueError, KeyError, TypeError, OSError) as exc:
        raise ContextInvalid("Prepared environmental context is invalid") from exc


def build_context(settings, analysis_id, *, budgets=None, dry_run=False, minimum_coverage=1.0):
    from surfacesignal.context.engine import assemble

    budgets = budgets or ContextBudgets()
    if not 0 < minimum_coverage <= 1:
        raise ValueError("Coverage threshold must be in (0,1]")
    repo = Repository(settings)
    analysis = repo.analysis(analysis_id)
    identity, payloads = assemble(
        settings, analysis, repo.area(analysis.area_id), budgets, minimum_coverage=minimum_coverage
    )
    identifier = digest(identity)[:24]
    if dry_run:
        return {
            "context_id": identifier,
            "analysis_id": analysis_id,
            "dry_run": True,
            "data_status": payloads["environmental-context.json"]["data_status"],
        }
    base = _base(settings, analysis.area_id, analysis_id)
    base.mkdir(parents=True, exist_ok=True)
    folder = safe_path(base / identifier)
    if folder.exists():
        manifest = _read(settings, analysis, folder, checksum(folder / "manifest.json"))["manifest"]
    else:
        staging = Path(tempfile.mkdtemp(prefix=".context-", dir=base))
        try:
            from surfacesignal.publication import _check_public

            for name, payload in payloads.items():
                _check_public(payload, settings.root)
                write_json(staging / name, payload)
            manifest = {
                "context_id": identifier,
                "identity": identity,
                "files": {name: checksum(staging / name) for name in payloads},
            }
            write_json(staging / "manifest.json", manifest)
            if sum(p.stat().st_size for p in staging.iterdir()) > budgets.max_output_bytes:
                raise ValueError("Context output byte budget exceeded")
            os.rename(staging, folder)
            _read(settings, analysis, folder, checksum(folder / "manifest.json"))
        finally:
            if staging.exists():
                shutil.rmtree(staging)
    write_json(
        base / "current.json",
        {"context_id": identifier, "manifest_sha256": checksum(folder / "manifest.json")},
    )
    return manifest


def area_payloads(settings, area_id):
    repo = Repository(settings)
    repo.area(area_id)
    for analysis in repo.analyses(area_id=area_id):
        try:
            yield load_context(settings, analysis.analysis_id)["payloads"]
        except ContextNotPrepared:
            continue


def area_events(settings, area_id):
    values = {}
    for payload in area_payloads(settings, area_id):
        for item in payload["environmental-events.json"]["items"]:
            values[item["event_id"]] = item
    return sorted(values.values(), key=lambda item: (item["observed_at"], item["event_id"]))


def area_reference_layers(settings, area_id):
    values = {}
    for payload in area_payloads(settings, area_id):
        for item in payload["reference-layers.json"]["items"]:
            values[(item["layer_id"], item["synthetic"])] = item
    return {"area_id": area_id, "items": list(values.values())}
