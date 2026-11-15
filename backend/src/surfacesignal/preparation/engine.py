"""Deterministic historical evidence and preparation proposals; generation is offline."""

import hashlib
import json

from surfacesignal.domain import Analysis, AreaConfig, comparable
from surfacesignal.preparation.content import COPY, SOURCES, VERSION, guidance
from surfacesignal.preparation.context import bounded_json, intersections, safe_path
from surfacesignal.preparation.models import (
    Action,
    GuidanceSource,
    LocalReport,
    Observation,
    PreparationPlan,
)
from surfacesignal.processing.general_change import load_derived
from surfacesignal.processing.history import GROUP_FIELDS
from surfacesignal.processing.pipeline import verify_artifacts
from surfacesignal.publication import _check_public
from surfacesignal.storage import checksum, safe_id

ALGORITHM = "local-preparation-v1"


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, allow_nan=False, ensure_ascii=True).encode()
    ).hexdigest()


def inputs(repo, area_id, budgets, *, illustrative=False, full=False):
    safe_path(repo.settings.areas_dir)
    # Identity must reflect current bytes, even if mtime/size are preserved.
    areas = []
    for path in sorted(repo.settings.areas_dir.glob("*.geojson")):
        value = bounded_json(path, budgets)
        area = AreaConfig(**value["properties"], geometry=value["geometry"])
        if area.area_id == area_id:
            areas.append(area)
    if len(areas) != 1:
        raise ValueError("Area missing or ambiguous")
    area = areas[0]
    selected = []
    for path in sorted(repo.settings.artifacts_dir.glob("*/manifest.json")):
        if path.parent.name.startswith("."):
            continue
        analysis = Analysis.model_validate(bounded_json(path, budgets))
        if (
            analysis.analysis_id != path.parent.name
            or len(analysis.scenes) != 2
            or not comparable(analysis.scenes[0], analysis.scenes[1])
            or analysis.scenes[0].maturity != analysis.scenes[1].maturity
            or any(
                s.area_id != analysis.area_id or s.synthetic != analysis.synthetic
                for s in analysis.scenes
            )
        ):
            raise ValueError("Analysis identity mismatch")
        if analysis.area_id == area_id and analysis.synthetic == illustrative:
            selected.append(analysis)
    selected.sort(key=lambda a: (a.scenes[-1].start_time, a.analysis_id))
    sources = []
    for a in selected:
        folder = safe_path(repo.settings.artifacts_dir / a.analysis_id)
        manifest = folder / "manifest.json"
        bounded_json(manifest, budgets)
        for name in a.artifacts:
            path = safe_path(folder / safe_id(name))
            if path.stat().st_size > budgets.max_input_bytes:
                raise ValueError("Input byte budget exceeded")
        # HTTP verifies prepared vector/metadata inputs, never TIFF/HDF5 content.
        for name in ("change-candidates.geojson", "statistics.json", "evidence.json"):
            path = safe_path(folder / name)
            if path.stat().st_size > budgets.max_input_bytes:
                raise ValueError("Input byte budget exceeded")
            if checksum(path) != a.artifacts[name]:
                raise ValueError("Source artifact integrity failure")
        derived_base = safe_path(repo.settings.root / "data/derived" / a.analysis_id)
        pointer = bounded_json(derived_base / "current.json", budgets)
        derived_folder = safe_path(derived_base / safe_id(pointer["derived_id"]))
        bounded_json(derived_folder / "manifest.json", budgets)
        for path in derived_folder.iterdir():
            safe_path(path)
            if path.is_file() and path.stat().st_size > budgets.max_input_bytes:
                raise ValueError("Input byte budget exceeded")
        if full:
            verify_artifacts(folder)
        d = load_derived(repo.settings.root, a.analysis_id, verify=True)
        if d is None:
            raise ValueError("Selected analysis requires general derivation")
        for name in d["artifacts"]:
            path = safe_path(
                repo.settings.root / "data/derived" / a.analysis_id / d["derived_id"] / name
            )
            if path.stat().st_size > budgets.max_input_bytes:
                raise ValueError("Input byte budget exceeded")
        sources.append(
            {
                "analysis_id": a.analysis_id,
                "source_manifest_sha256": checksum(manifest),
                "derived_id": d["derived_id"],
                "derived_manifest_sha256": checksum(
                    repo.settings.root
                    / "data/derived"
                    / a.analysis_id
                    / d["derived_id"]
                    / "manifest.json"
                ),
                "source_artifacts": a.artifacts,
                "derived_artifacts": d["artifacts"],
            }
        )
    identity = {
        "area_id": area_id,
        "area_sha256": digest(area.model_dump(mode="json")),
        "illustrative": illustrative,
        "algorithm": ALGORITHM,
        "content_version": VERSION,
        "content_sha256": digest(
            {"copy": COPY, "sources": [s.model_dump(mode="json") for s in SOURCES]}
        ),
        "budgets": budgets.model_dump(),
        "sources": sources,
    }
    _check_public(identity, repo.settings.root)
    return area, selected, identity


def assemble(repo, area_id, budgets, context=None, illustrative=False):
    if context and context["collection"]["metadata"].get("synthetic", False) != illustrative:
        raise ValueError("Context synthetic status must match selected data mode")
    area, analyses, identity = inputs(repo, area_id, budgets, illustrative=illustrative, full=True)
    identity["context_sha256"] = context["sha256"] if context else None
    provenance = {"algorithm": ALGORITHM, "content_version": VERSION, "inputs": identity}
    status = ("synthetic" if illustrative else "real") if analyses else "no_data"
    records = []
    for a in analyses:
        d = repo.derived(a)
        relations = None
        if context:
            relations = []
            for layer, path in [
                (
                    "general_change",
                    repo.settings.root
                    / "data/derived"
                    / a.analysis_id
                    / d["derived_id"]
                    / "general-change.geojson",
                ),
                (
                    "open_water",
                    repo.settings.artifacts_dir / a.analysis_id / "change-candidates.geojson",
                ),
            ]:
                relations += [
                    dict(r, layer=layer)
                    for r in intersections(context, bounded_json(path, budgets), budgets)
                ]
        records.append((a, d, relations))
    source_registry = list(SOURCES)
    if context:
        meta = context["collection"]["metadata"]
        source_registry.append(
            GuidanceSource(
                source_id="local-context",
                title="Imported local context / Contexto local importado",
                publisher=meta["publisher"],
                url=meta["source_url"],
                retrieved_on=meta["retrieved_at"],
                locator="SHA256: " + context["sha256"],
                applicability=meta["usage_statement"],
            )
        )
    if analyses:
        source_registry.append(
            GuidanceSource(
                source_id="nisar-observation",
                title="NISAR observations / Observações NISAR",
                publisher="NASA / ISRO; SurfaceSignal processing",
                url="https://science.nasa.gov/mission/nisar/",
                retrieved_on="2026-11-15",
                locator="Exact acquisitions and artifact hashes are listed in provenance.inputs.sources",
                applicability="Historical radar observations; overlap does not establish flood or damage.",
            )
        )
    payloads = {}
    for lang, copy in COPY.items():
        observations = []
        for a, d, relations in records:
            story = repo.story(a, lang)
            observations.append(
                Observation(
                    analysis_id=a.analysis_id,
                    before_time=a.scenes[0].start_time,
                    after_time=a.scenes[1].start_time,
                    group={k: getattr(a.scenes[0], k) for k in GROUP_FIELDS},
                    parameters=a.parameters,
                    general_parameters=d["parameters"],
                    valid_area_km2=d["statistics"].get("valid_area_km2"),
                    changed_area_km2=d["statistics"].get("changed_area_km2"),
                    water_candidate_area_km2=a.statistics.get("candidate_area_km2"),
                    summary=story.summary,
                    interpretation=story.interpretation,
                    alternative_explanations=story.alternative_explanations,
                    limitations=story.limitations,
                    sources=story.sources,
                    local_relations=relations,
                    provenance=next(
                        s for s in identity["sources"] if s["analysis_id"] == a.analysis_id
                    ),
                )
            )
        notice = (copy["synthetic"] if illustrative else "") + copy["notice"]
        report = LocalReport(
            area_id=area_id,
            area_name=area.name,
            language=lang,
            title=(copy["synthetic"] if illustrative else "") + copy["title"] + area.name,
            notice=notice,
            data_status=status,
            context_status="available" if context else "unavailable",
            context_source=dict(context["collection"]["metadata"], sha256=context["sha256"])
            if context
            else None,
            observations=observations,
            limitations=copy["limits"],
            provenance=provenance,
        )
        payloads[f"local-analysis.{lang}.json"] = report.model_dump(mode="json")
        for audience in ("residents", "municipal"):
            actions = guidance(lang, audience)
            if audience == "municipal":
                for obs in observations:
                    # One proposed task per feature/comparison even when both layers overlap.
                    hits = {r.feature_id: r for r in (obs.local_relations or []) if r.intersects}
                    for fid, relation in sorted(hits.items()):
                        actions.append(
                            Action(
                                action_id="review-" + digest([obs.analysis_id, fid])[:24],
                                audience=audience,
                                objective=copy["verification"],
                                task=copy["review"].format(name=relation.name),
                                reason=copy["review_reason"].format(
                                    before=obs.before_time.isoformat(),
                                    after=obs.after_time.isoformat(),
                                ),
                                basis="observed_overlap",
                                origin="surfacesignal_proposal",
                                evidence_ids=[obs.analysis_id],
                                source_ids=["local-context", "nisar-observation"],
                                feature_id=fid,
                                suggested_role=copy["role"],
                            )
                        )
            plan = PreparationPlan(
                area_id=area_id,
                area_name=area.name,
                language=lang,
                audience=audience,
                title=(copy["synthetic"] if illustrative else "") + copy["plan"] + area.name,
                notice=notice,
                data_status=status,
                actions=actions,
                sources=source_registry,
                limitations=copy["limits"],
                provenance=provenance,
            )
            payloads[f"preparation.{audience}.{lang}.json"] = plan.model_dump(mode="json")
    for value in payloads.values():
        _check_public(value, repo.settings.root)
    return {"identity": identity, "payloads": payloads}
