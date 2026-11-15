"""Serial offline writer and integrity-checked read-only prepared report access."""

import hashlib
import json
import os
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from surfacesignal.api.service import Repository, StoreUnavailable
from surfacesignal.preparation.content import COPY
from surfacesignal.preparation.context import bounded_json, read_context, safe_path
from surfacesignal.preparation.engine import assemble, digest, inputs
from surfacesignal.preparation.models import Budgets, LocalReport, PreparationPlan
from surfacesignal.storage import checksum, safe_id, sync_directory, write_json

PAYLOADS = frozenset(
    [f"local-analysis.{lang}.json" for lang in ("pt", "en")]
    + [
        f"preparation.{audience}.{lang}.json"
        for audience in ("residents", "municipal")
        for lang in ("pt", "en")
    ]
)


class PreparationNotPrepared(FileNotFoundError):
    pass


class PreparationInvalid(StoreUnavailable):
    pass


def _base(settings, area_id):
    return safe_path(settings.root / "data/preparation" / safe_id(area_id))


def _markdown(payloads, lang):
    report = payloads[f"local-analysis.{lang}.json"]
    labels = COPY[lang]["report_labels"]

    def measure(value):
        return labels["unknown"] if value is None else str(value)

    lines = [
        f"# {report['title']}",
        "",
        report["notice"],
        "",
        f"{labels['data']}: {report['data_status']}; {labels['context']}: {report['context_status']}",
        "",
    ]
    for obs in report["observations"]:
        lines += [
            f"## {obs['before_time']} → {obs['after_time']}",
            "",
            f"{labels['analysis']}: {obs['analysis_id']}",
            obs["summary"],
            "",
            obs["interpretation"],
            "",
            f"{labels['valid']} (km²): {measure(obs['valid_area_km2'])}; {labels['changed']} (km²): {measure(obs['changed_area_km2'])}; {labels['water']} (km²): {measure(obs['water_candidate_area_km2'])}",
            "",
        ]
        for relation in obs["local_relations"] or []:
            if relation["intersects"]:
                lines += [
                    f"- {relation['name']} ({relation['feature_id']}): {relation['layer']}; {labels['overlap']} (km²): {measure(relation['overlap_km2'])}"
                ]
        lines += ["", *[f"- {item}" for item in obs["limitations"]], ""]
    for audience in ("residents", "municipal"):
        plan = payloads[f"preparation.{audience}.{lang}.json"]
        lines += [f"## {plan['title']} ({labels[audience]})", ""]
        for action in plan["actions"]:
            lines += [
                f"### {action['objective']} [{action['action_id']}]",
                "",
                action["task"],
                "",
                action["reason"],
                f"{labels['sources']}: {', '.join(action['source_ids'])}; {labels['evidence']}: {', '.join(action['evidence_ids']) or '—'}; {labels['status']}: {labels['proposed']}",
                "",
            ]
        lines += ["## " + labels["sources"], ""]
        for source in plan["sources"]:
            lines += [
                f"- [{source['title']}]({source['url']}) — {source['publisher']}; retrieved {source['retrieved_on']}; {source['locator']}; {source['applicability']}"
            ]
    lines += [
        "",
        "## " + labels["limits"],
        "",
        *[f"- {item}" for item in report["limitations"]],
        "",
        "## " + labels["provenance"],
        "",
        "```json",
        json.dumps(report["provenance"], indent=2, sort_keys=True),
        "```",
        "",
    ]
    return "\n".join(lines)


def _read(settings, area_id, report_id, manifest_sha256):
    folder = safe_path(_base(settings, area_id) / safe_id(report_id))
    manifest_path = safe_path(folder / "manifest.json")
    manifest = bounded_json(manifest_path, Budgets(max_input_bytes=1_000_000))
    if checksum(manifest_path) != manifest_sha256:
        raise ValueError("Preparation manifest integrity failure")
    identity = manifest["identity"]
    if (
        manifest["report_id"] != report_id
        or digest(identity)[:24] != report_id
        or identity["area_id"] != area_id
    ):
        raise ValueError("Preparation identity mismatch")
    budgets = Budgets.model_validate(identity["budgets"])
    expected = PAYLOADS | {"report.pt.md", "report.en.md"}
    if identity["context_sha256"]:
        expected |= {"context.geojson"}
    if set(manifest["files"]) != expected:
        raise ValueError("Incomplete preparation inventory")
    actual = set()
    total = 0
    for path in folder.iterdir():
        safe_path(path)
        if not path.is_file():
            raise ValueError("Unexpected preparation inventory")
        actual.add(path.name)
        total += path.stat().st_size
    if actual != expected | {"manifest.json"} or total > budgets.max_output_bytes:
        raise ValueError("Preparation inventory or byte budget mismatch")
    for name, sha in manifest["files"].items():
        if checksum(folder / name) != sha:
            raise ValueError("Preparation output integrity failure")
    # Fresh repository avoids inheriting an application's cache when checking staleness.
    repo = Repository(settings)
    _, _, current = inputs(repo, area_id, budgets, illustrative=identity["illustrative"])
    if identity["context_sha256"]:
        context = read_context(folder / "context.geojson", budgets)
        if context["sha256"] != identity["context_sha256"]:
            raise ValueError("Context identity mismatch")
    current["context_sha256"] = identity["context_sha256"]
    if current != identity:
        raise ValueError("Stale preparation inputs; rebuild offline")
    payloads = {}
    read_budget = Budgets(max_input_bytes=budgets.max_output_bytes)
    for name in sorted(PAYLOADS):
        model = LocalReport if name.startswith("local-analysis") else PreparationPlan
        payload = model.model_validate(bounded_json(folder / name, read_budget))
        if payload.area_id != area_id or payload.provenance["inputs"] != identity:
            raise ValueError("Preparation payload identity mismatch")
        payloads[name] = payload.model_dump(mode="json")
    return {"manifest": manifest, "payloads": payloads}


def load_preparation(settings, area_id):
    Repository(settings).area(area_id)  # Unknown area is distinct from known/unprepared.
    try:
        pointer_path = safe_path(_base(settings, area_id) / "current.json")
        if not pointer_path.exists():
            raise PreparationNotPrepared("Preparation not built; run preparation build offline")
        pointer = bounded_json(pointer_path, Budgets(max_input_bytes=4096))
        if set(pointer) != {"report_id", "manifest_sha256"}:
            raise ValueError("Invalid preparation pointer")
        return _read(settings, area_id, pointer["report_id"], pointer["manifest_sha256"])
    except PreparationNotPrepared:
        raise
    except (ValueError, KeyError, TypeError, OSError) as exc:
        raise PreparationInvalid("Prepared preparation data is unavailable or invalid") from exc


def build_preparation(settings, area_id, *, context_path=None, illustrative=False, budgets=None):
    budgets = budgets or Budgets()
    repo = Repository(settings)
    repo.area(area_id)
    context = read_context(context_path, budgets) if context_path else None
    result = assemble(repo, area_id, budgets, context=context, illustrative=illustrative)
    identity, payloads = result["identity"], result["payloads"]
    report_id = digest(identity)[:24]
    base = _base(settings, area_id)
    folder = safe_path(base / report_id)
    base.mkdir(parents=True, exist_ok=True)
    if folder.exists():
        manifest_path = safe_path(folder / "manifest.json")
        existing = _read(settings, area_id, report_id, checksum(manifest_path))["manifest"]
        write_json(
            base / "current.json",
            {"report_id": report_id, "manifest_sha256": checksum(manifest_path)},
        )
        return existing
    staging = Path(tempfile.mkdtemp(prefix=".preparation-", dir=base))
    try:
        total = 0

        def emit(name, value, *, text=False):
            nonlocal total
            serialized = (
                value
                if text
                else json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n"
            )
            size = len(serialized.encode())
            total += size
            if total > budgets.max_output_bytes:
                raise ValueError("Preparation output byte budget exceeded")
            if text:
                with (staging / name).open("w") as stream:
                    stream.write(value)
                    stream.flush()
                    os.fsync(stream.fileno())
            else:
                write_json(staging / name, value)

        for name, payload in payloads.items():
            emit(name, payload)
        for lang in ("pt", "en"):
            emit(f"report.{lang}.md", _markdown(payloads, lang), text=True)
        if context:
            # Preserve input bytes: the context identity is the imported file's SHA256.
            data = safe_path(context_path).read_bytes()
            if hashlib.sha256(data).hexdigest() != context["sha256"]:
                raise ValueError("Context changed during build")
            total += len(data)
            if total > budgets.max_output_bytes:
                raise ValueError("Preparation output byte budget exceeded")
            with (staging / "context.geojson").open("wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
        manifest = {
            "report_id": report_id,
            "generated_at": datetime.now(UTC).isoformat(),
            "identity": identity,
            "files": {p.name: checksum(p) for p in sorted(staging.iterdir())},
        }
        emit("manifest.json", manifest)
        sync_directory(staging)
        os.rename(staging, folder)
        sync_directory(base)
        _read(settings, area_id, report_id, checksum(folder / "manifest.json"))
        write_json(
            base / "current.json",
            {"report_id": report_id, "manifest_sha256": checksum(folder / "manifest.json")},
        )
        return manifest
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def verify_preparation(settings, area_id):
    value = load_preparation(settings, area_id)
    return {
        "area_id": area_id,
        "report_id": value["manifest"]["report_id"],
        "verified": True,
        "file_count": len(value["manifest"]["files"]),
        "validation_status": "not_validated",
    }
