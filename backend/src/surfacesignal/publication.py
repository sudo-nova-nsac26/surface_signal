"""Bounded offline publication of verified prepared science; no raw inputs exported."""

import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from surfacesignal.config import Settings
from surfacesignal.processing.general_change import derived_artifact_path, load_derived
from surfacesignal.processing.pipeline import verify_artifacts
from surfacesignal.storage import checksum, read_json, safe_id, write_json


def _plain(value):
    return value.model_dump(mode="json") if hasattr(value, "model_dump") else value


def _page(items):
    return {
        "items": [_plain(v) for v in items],
        "total": len(items),
        "offset": 0,
        "limit": max(1, len(items)),
    }


def _target(root, output):
    root = Path(root).resolve()
    output = Path(output).absolute()
    for ancestor in [output, *output.parents]:
        if ancestor.is_symlink():
            raise ValueError("Symlinked publication output")
    output = output.resolve()
    forbidden = [
        root / p
        for p in (
            "data/raw",
            "data/derived",
            "data/preparation",
            "data/context",
            "artifacts",
            "config",
            "backend",
            ".git",
        )
    ]
    if (
        output == root
        or root.is_relative_to(output)
        or any(output.is_relative_to(p) or p.is_relative_to(output) for p in forbidden)
    ):
        raise ValueError("Unsafe publication output")
    return output


def _rewrite(value):
    if isinstance(value, dict):
        return {k: _rewrite(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_rewrite(v) for v in value]
    if isinstance(value, str) and value.startswith("/api/v1/"):
        parsed = urlsplit(value)
        relative = parsed.path.removeprefix("/api/v1/")
        if relative == "context/sources":
            relative = "context-sources"
        if "/artifacts/" not in relative and "/references/" not in relative:
            query = parse_qs(parsed.query)
            lang = query.get("lang", [None])[0]
            if relative.endswith("/preparation"):
                audience = query.get("audience", ["residents"])[0]
                if audience not in {"residents", "municipal"}:
                    raise ValueError("Invalid preparation audience")
                relative += "." + audience
                lang = lang or "pt"
            if lang is None and relative.rsplit("/", 1)[-1] in {
                "story",
                "stories",
                "timeline",
                "overview",
                "local-analysis",
            }:
                lang = "pt"
            if lang and lang in {"pt", "en"}:
                relative += "." + lang
            relative += ".json"
        return "/data/api/v1/" + relative
    return value


def _check_public(value, root, _resolved_root=None):
    resolved_root = _resolved_root or str(Path(root).resolve())
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in {
                "password",
                "token",
                "earthdata_token",
                "authorization",
                "netrc",
                "source_path",
                "local_path",
                "raw_path",
            }:
                raise ValueError("Private field cannot be published")
            _check_public(item, root, resolved_root)
    elif isinstance(value, list):
        for item in value:
            _check_public(item, root, resolved_root)
    elif isinstance(value, str):
        if resolved_root in value or value.startswith(("/home/", "/Users/", "/tmp/")):
            raise ValueError("Local filesystem path cannot be published")
        if value.startswith(("http://", "https://")):
            url = urlsplit(value)
            sensitive = {
                "token",
                "access_token",
                "password",
                "authorization",
                "signature",
                "x-amz-signature",
                "x-amz-credential",
            }
            if (
                url.username
                or url.password
                or sensitive.intersection(k.lower() for k in parse_qs(url.query))
            ):
                raise ValueError("Credential-bearing URL cannot be published")


def _validate_internal_urls(value, staging):
    if isinstance(value, dict):
        for item in value.values():
            _validate_internal_urls(item, staging)
    elif isinstance(value, list):
        for item in value:
            _validate_internal_urls(item, staging)
    elif isinstance(value, str) and value.startswith(("/data/api/v1/", "/api/v1/")):
        if value.startswith("/api/v1/"):
            raise ValueError("Unmapped internal publication URL")
        relative = unquote(urlsplit(value).path.removeprefix("/data/api/v1/"))
        destination = staging / relative
        if not destination.resolve().is_relative_to(staging.resolve()) or not destination.is_file():
            raise ValueError("Unresolved internal publication URL")
        for path in [destination, *destination.parents]:
            if path == staging:
                break
            if path.is_symlink():
                raise ValueError("Symlinked internal publication URL")


def build_publication(
    settings: Settings,
    area_id: str,
    output: Path,
    *,
    validate=True,
    exclude_synthetic=False,
    include_previews=False,
    include_preparation=False,
    include_environmental_context=False,
    max_export_bytes=100_000_000,
) -> dict:
    """Publish one area's API responses, retaining a deterministic previous-snapshot backup.

    ``validate`` is retained as an explicit CLI flag; integrity validation is mandatory.
    """
    from surfacesignal.api.service import Repository

    safe_id(area_id)
    if (
        isinstance(max_export_bytes, bool)
        or not isinstance(max_export_bytes, int)
        or max_export_bytes < 1
    ):
        raise ValueError("Invalid publication byte budget")
    output = _target(settings.root, output)
    repository = Repository(settings)
    areas = [a for a in repository.areas() if a.area_id == area_id]
    if not areas:
        raise ValueError("Area not found")
    analyses = repository.analyses(
        area_id=area_id, exclude_synthetic=exclude_synthetic, sort_by="date"
    )
    scenes = [
        s
        for s in repository.scenes()
        if s.area_id == area_id and (not exclude_synthetic or not s.synthetic)
    ]
    derived = {}
    provenance = []
    for analysis in analyses:
        aid = analysis.analysis_id
        original = verify_artifacts(settings.artifacts_dir / aid)
        result = load_derived(settings.root, aid, verify=True)
        if result is None:
            raise ValueError("Selected analysis has no verified derivation")
        derived[aid] = result
        provenance.append(
            {
                "analysis_id": aid,
                "original_manifest_sha256": checksum(
                    settings.artifacts_dir / aid / "manifest.json"
                ),
                "original_artifacts": original.artifacts,
                "derived_id": result["derived_id"],
                "derived_artifacts": result["artifacts"],
            }
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".publication-", dir=output.parent))
    byte_count = 0
    try:

        def budget(path):
            nonlocal byte_count
            byte_count += path.stat().st_size
            if byte_count > max_export_bytes:
                raise ValueError("Publication exceeds byte budget")

        def emit(name, value):
            path = staging / name
            payload = _rewrite(_plain(value))
            _check_public(payload, settings.root)
            write_json(path, payload)
            budget(path)

        emit("areas.json", _page(areas))
        emit("scenes.json", _page([repository.scene_availability(s) for s in scenes]))
        emit("analyses.json", _page(analyses))
        emit("layers.json", repository.layers())
        from surfacesignal.interpretation.engine import institutional_stories, methodology
        from surfacesignal.processing.capabilities import capabilities

        emit("capabilities.json", _page(capabilities()))
        emit("methodology.json", methodology())
        for lang in ("pt", "en"):
            emit(f"stories.{lang}.json", institutional_stories(lang))
        for area in areas:
            emit(f"areas/{area.area_id}.json", area)
            for lang in ("pt", "en"):
                emit(
                    f"areas/{area.area_id}/timeline.{lang}.json",
                    repository.timeline(
                        area.area_id, lang=lang, exclude_synthetic=exclude_synthetic
                    ),
                )
                emit(
                    f"areas/{area.area_id}/overview.{lang}.json",
                    repository.overview(
                        area.area_id, lang=lang, exclude_synthetic=exclude_synthetic
                    ),
                )
        for scene in scenes:
            emit(f"scenes/{safe_id(scene.scene_id)}.json", repository.scene_availability(scene))
        for analysis in analyses:
            aid = analysis.analysis_id
            prefix = f"analyses/{aid}"
            detail = analysis.model_dump(mode="json")
            detail.update(
                derived=derived[aid],
                links={
                    key: f"/api/v1/{prefix}/{key}"
                    for key in ["statistics", "layers", "story", "evidence"]
                },
            )
            emit(prefix + ".json", detail)
            emit(prefix + "/evidence.json", analysis.evidence)
            emit(prefix + "/layers.json", repository.layers(analysis))
            emit(prefix + "/statistics.json", repository.statistics(analysis))
            for lang in ("pt", "en"):
                emit(prefix + f"/story.{lang}.json", repository.story(analysis, lang))
            names = [
                name
                for name in analysis.artifacts
                if name.endswith(".geojson") or (include_previews and name.endswith(".png"))
            ]
            names += [name for name in derived[aid]["artifacts"] if name.endswith(".geojson")]
            links = {}
            for name in sorted(names):
                path = (
                    repository.artifact_path(aid, name)
                    if name in analysis.artifacts
                    else derived_artifact_path(settings.root, aid, name)
                )
                destination = staging / prefix / "artifacts" / name
                if path.is_symlink() or not path.is_file():
                    raise ValueError("Unsafe source artifact")
                if byte_count + path.stat().st_size > max_export_bytes:
                    raise ValueError("Publication exceeds byte budget")
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)
                budget(destination)
                links[name] = f"/api/v1/{prefix}/artifacts/{name}"
            emit(prefix + "/artifacts.json", links)
        from surfacesignal.providers.sources import SOURCES

        emit("sources.json", _page(SOURCES))
        if include_environmental_context:
            from surfacesignal.context.publication import emit_environmental_context

            emit_environmental_context(settings, area_id, analyses, exclude_synthetic, emit)
        if include_preparation:
            from surfacesignal.preparation.store import load_preparation

            prepared = load_preparation(settings, area_id)
            selected_ids = {a.analysis_id for a in analyses}
            prepared_ids = {s["analysis_id"] for s in prepared["manifest"]["identity"]["sources"]}
            if prepared_ids != selected_ids or (
                exclude_synthetic and prepared["manifest"]["identity"]["illustrative"]
            ):
                raise ValueError("Preparation selection differs from publication selection")
            for name, payload in prepared["payloads"].items():
                emit(f"areas/{area_id}/{name}", payload)
            emit(f"areas/{area_id}/preparation-manifest.json", prepared["manifest"])
        for path in sorted(settings.catalog_dir.glob("*.json")):
            if path.is_symlink():
                raise ValueError("Symlinked catalog")
            catalog = read_json(path)
            if catalog.get("area_id") == area_id:
                from surfacesignal.domain import CatalogSnapshot

                catalog = CatalogSnapshot.model_validate(catalog).model_dump(mode="json")
                catalog["scenes"] = [_plain(s) for s in scenes]
                emit(f"catalogs/{area_id}.json", catalog)
        for path in staging.rglob("*.json"):
            _validate_internal_urls(read_json(path), staging)
        hashes = {
            str(p.relative_to(staging)): checksum(p)
            for p in sorted(staging.rglob("*"))
            if p.is_file()
        }
        identity_data = {
            "area_id": area_id,
            "exclude_synthetic": exclude_synthetic,
            "include_previews": include_previews,
            "include_environmental_context": include_environmental_context,
            "sources": provenance,
            "files": hashes,
        }
        identifier = hashlib.sha256(json.dumps(identity_data, sort_keys=True).encode()).hexdigest()[
            :24
        ]
        previous = output / "publication-report.json"
        if previous.is_file() and not previous.is_symlink():
            report = read_json(previous)
            if report.get("publication_id") == identifier:
                if report.get("files") != hashes:
                    raise ValueError("Existing publication inventory differs")
                actual = set()
                for path in output.rglob("*"):
                    if path.is_symlink() or not path.resolve().is_relative_to(output):
                        raise ValueError("Symlinked existing publication inventory")
                    if path.is_file():
                        actual.add(str(path.relative_to(output)))
                if actual != set(hashes) | {"publication-report.json"}:
                    raise ValueError("Existing publication inventory differs")
                for name, sha in hashes.items():
                    path = output / name
                    if checksum(path) != sha:
                        raise ValueError("Existing publication integrity failure")
                if byte_count + previous.stat().st_size > max_export_bytes:
                    raise ValueError("Publication exceeds byte budget")
                return report
        backup = None
        if output.exists():
            old_hashes = {}
            for path in sorted(output.rglob("*")):
                if path.is_symlink():
                    raise ValueError("Symlinked existing publication")
                if path.is_file():
                    old_hashes[str(path.relative_to(output))] = checksum(path)
            old_id = hashlib.sha256(json.dumps(old_hashes, sort_keys=True).encode()).hexdigest()[
                :16
            ]
            backup = output.with_name(output.name + ".backup-" + old_id)
            if backup.exists():
                raise ValueError("Publication backup already exists; preserve it before retrying")
        report = {
            "publication_id": identifier,
            "area_id": area_id,
            "analysis_count": len(analyses),
            "scene_count": len(scenes),
            "file_count": len(hashes),
            "bytes": byte_count,
            "bytes_scope": "All exported files except publication-report.json; byte budget includes the report.",
            "files": hashes,
            "sources": provenance,
            "validated": True,
            "exclude_synthetic": exclude_synthetic,
            "include_previews": include_previews,
            "include_environmental_context": include_environmental_context,
            "backup_path": str(backup.relative_to(settings.root.resolve()))
            if backup and backup.is_relative_to(settings.root.resolve())
            else os.path.relpath(backup, settings.root.resolve())
            if backup
            else None,
        }
        emit("publication-report.json", report)
        staging.chmod(0o755)
        if backup:
            os.rename(output, backup)
        try:
            os.rename(staging, output)
        except OSError:
            if backup:
                os.rename(backup, output)
            raise
        return report
    finally:
        if staging.exists():
            shutil.rmtree(staging)
