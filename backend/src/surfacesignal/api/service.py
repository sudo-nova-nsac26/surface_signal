"""Read-only prepared-data service shared by HTTP and offline publication.

Only verified local scientific outputs or committed publication snapshots are read.
No HTTP call downloads an Earthdata scene or executes image processing. Future
area expansion must preserve this separation and surface missing metrics as null.
"""

import hashlib
import json
from functools import lru_cache
from pathlib import Path

from surfacesignal.api.schemas import (
    AcquisitionGroup,
    CapabilityStatistics,
    Comparison,
    Layer,
    LayerIndex,
    Overview,
    Statistics,
    TemporalInterpretation,
    Timeline,
)
from surfacesignal.domain import (
    Analysis,
    AreaConfig,
    CatalogSnapshot,
    SceneAvailability,
    comparable,
)
from surfacesignal.interpretation.content import LIMITATIONS
from surfacesignal.interpretation.engine import build_story
from surfacesignal.processing.capabilities import capabilities
from surfacesignal.processing.general_change import (
    DERIVED_ARTIFACT_NAMES,
    derived_artifact_path,
    load_derived,
)
from surfacesignal.processing.history import GROUP_FIELDS, candidate_pairs
from surfacesignal.processing.pipeline import ARTIFACT_NAMES
from surfacesignal.storage import read_json, safe_id


class StoreUnavailable(ValueError):
    pass


def confined(path, base):
    if path.is_symlink() or not path.resolve().is_relative_to(base.resolve()):
        raise StoreUnavailable("Prepared data path is invalid")
    # Reject symlinked intermediate directories even when pointing inside the base.
    for parent in path.parents:
        if parent == base:
            break
        if parent.is_symlink():
            raise StoreUnavailable("Prepared data path is invalid")
    return path


@lru_cache(maxsize=2048)
def _cached_json(path, mtime_ns, size):
    return read_json(Path(path))


def metadata(path, base):
    confined(path, base)
    stat = path.stat()
    return _cached_json(str(path), stat.st_mtime_ns, stat.st_size)


def stable_id(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:24]


class Repository:
    def __init__(self, settings):
        self.settings = settings

    def areas(self):
        return [
            AreaConfig(**v["properties"], geometry=v["geometry"])
            for p in sorted(self.settings.areas_dir.glob("*.geojson"))
            for v in [metadata(p, self.settings.areas_dir)]
        ]

    def area(self, identifier):
        for a in self.areas():
            if a.area_id == identifier:
                return a
        raise FileNotFoundError("Area not found")

    def scenes(self):
        result = {}
        for p in sorted(self.settings.catalog_dir.glob("*.json")):
            for s in CatalogSnapshot.model_validate(metadata(p, self.settings.catalog_dir)).scenes:
                if s.scene_id in result and result[s.scene_id] != s:
                    raise StoreUnavailable("Conflicting catalog entries")
                result[s.scene_id] = s
        return sorted(result.values(), key=lambda s: (s.start_time, s.scene_id))

    def scene_availability(self, s):
        path = self.settings.root / "data/raw" / (safe_id(s.scene_id) + ".h5")
        available = (
            not path.is_symlink()
            and path.resolve().parent == (self.settings.root / "data/raw").resolve()
            and path.is_file()
            and path.stat().st_size == s.size_bytes
        )
        return SceneAvailability(**s.model_dump(), local_available=available)

    def analysis(self, identifier):
        safe_id(identifier)
        path = self.settings.artifacts_dir / identifier / "manifest.json"
        a = Analysis.model_validate(metadata(path, self.settings.artifacts_dir))
        if (
            a.analysis_id != identifier
            or len(a.scenes) != 2
            or not comparable(a.scenes[0], a.scenes[1])
            or a.scenes[0].maturity != a.scenes[1].maturity
            or any(s.area_id != a.area_id or s.synthetic != a.synthetic for s in a.scenes)
        ):
            raise StoreUnavailable("Analysis identity mismatch")
        return a

    def derived(self, a):
        # load_derived checks small outputs; cache is invalidated by inventory stat changes.
        base = self.settings.root / "data/derived" / a.analysis_id
        if not base.exists():
            return None
        source_path = self.settings.artifacts_dir / a.analysis_id / "manifest.json"
        source_stat = source_path.stat()
        source_signature = ((str(source_path), source_stat.st_mtime_ns, source_stat.st_size),)
        signature = source_signature + tuple(
            (str(p), p.stat().st_mtime_ns, p.stat().st_size)
            for p in sorted(base.glob("**/*"))
            if p.is_file()
        )
        return self._derived_cached(a.analysis_id, signature)

    @lru_cache(maxsize=256)  # noqa: B019 - bounded per application repository cache
    def _derived_cached(self, identifier, signature):
        try:
            return load_derived(self.settings.root, identifier)
        except ValueError as exc:
            raise StoreUnavailable("Invalid derived data") from exc

    def analyses(self, area_id=None, exclude_synthetic=False, sort_by="date"):
        if area_id:
            self.area(area_id)
        items = [
            self.analysis(p.parent.name)
            for p in sorted(self.settings.artifacts_dir.glob("*/manifest.json"))
            if not p.parent.name.startswith(".")
        ]
        items = [
            a
            for a in items
            if (not area_id or a.area_id == area_id) and (not exclude_synthetic or not a.synthetic)
        ]

        def key(a):
            stats = (self.derived(a) or {}).get("statistics", {})
            value = {
                "changed_area": stats.get("changed_area_km2"),
                "magnitude": max(
                    abs(stats.get("min_delta_db") or 0), abs(stats.get("max_delta_db") or 0)
                )
                if stats
                else None,
                "components": stats.get("increase_components", 0)
                + stats.get("decrease_components", 0)
                if stats
                else None,
            }.get(sort_by)
            if sort_by == "date":
                return (a.scenes[-1].start_time, a.analysis_id)
            if sort_by == "acquisition":
                return (
                    str(tuple(getattr(a.scenes[0], k) for k in GROUP_FIELDS)),
                    a.scenes[-1].start_time,
                    a.analysis_id,
                )
            return (value is None, -(value or 0), a.analysis_id)

        return sorted(items, key=key)

    def artifact_path(self, identifier, name):
        a = self.analysis(identifier)
        if name in DERIVED_ARTIFACT_NAMES and name != "manifest.json":
            try:
                return derived_artifact_path(self.settings.root, identifier, name)
            except ValueError as exc:
                raise StoreUnavailable("Invalid derived data") from exc
        if name not in ARTIFACT_NAMES or (name != "manifest.json" and name not in a.artifacts):
            raise FileNotFoundError("Artifact not found")
        path = self.settings.artifacts_dir / identifier / name
        confined(path, self.settings.artifacts_dir / identifier)
        if not path.is_file():
            raise FileNotFoundError("Artifact not found")
        return path

    def statistics(self, a):
        d = self.derived(a)
        units = {
            "*_area_km2": "km2",
            "*_delta_db": "dB",
            "*_percent": "percent of valid pixels",
            "*_pixels": "pixels",
            "*_components": "connected pixel groups",
        }
        return Statistics(
            analysis_id=a.analysis_id,
            general_change=CapabilityStatistics(
                status="available" if d else "unavailable",
                method=d["algorithm"] if d else "general-radar-change-v1",
                units=units,
                parameters=d["parameters"] if d else None,
                statistics=d["statistics"] if d else None,
                derived_id=d["derived_id"] if d else None,
            ),
            open_water=CapabilityStatistics(
                status="available",
                method="open-water-change-v2",
                units=units,
                parameters=a.parameters,
                statistics=a.statistics,
            ),
        )

    def story(self, a, lang="pt"):
        return build_story(a, self.derived(a), lang)

    def layers(self, analysis=None):
        d = self.derived(analysis) if analysis else None
        files = {
            "general_change": "general-change.geojson",
            "radar_increase": "radar-increase.geojson",
            "radar_decrease": "radar-decrease.geojson",
            "open_water": "change-candidates.geojson",
        }
        colors = {"radar_increase": "#D55E00", "radar_decrease": "#0072B2", "open_water": "#56B4E9"}
        items = []
        for c in capabilities():
            available = bool(
                analysis and (c.capability_id == "open_water" or (d and c.capability_id in files))
            )
            legend = [
                {"class": key, "color": color}
                for key, color in colors.items()
                if key == c.capability_id
                or (c.capability_id == "general_change" and key != "open_water")
            ]
            items.append(
                Layer(
                    layer_id=c.capability_id,
                    name=c.name,
                    description=c.description,
                    status="available"
                    if available
                    else c.implementation_status
                    if c.capability_id not in files
                    else "not_prepared",
                    legend=legend,
                    measurement="delta_gamma0_db"
                    if c.result_type == "observation"
                    else c.result_type,
                    artifact_url=f"/api/v1/analyses/{analysis.analysis_id}/artifacts/{files[c.capability_id]}"
                    if available
                    else None,
                    method=c.scientific_method,
                    available=available,
                    limitations=c.limitations,
                )
            )
        return LayerIndex(analysis_id=analysis.analysis_id if analysis else None, items=items)

    def timeline(self, area_id, lang="pt", exclude_synthetic=False):
        self.area(area_id)
        analyses = self.analyses(area_id, exclude_synthetic)
        observations = {
            s.scene_id: s
            for s in self.scenes()
            if s.area_id == area_id and (not exclude_synthetic or not s.synthetic)
        }
        for a in analyses:
            for s in a.scenes:
                if s.scene_id in observations and observations[s.scene_id] != s:
                    raise StoreUnavailable("Catalog and analysis scene disagree")
                observations[s.scene_id] = s
        scenes = sorted(observations.values(), key=lambda s: (s.start_time, s.scene_id))
        pairs, raw_groups = candidate_pairs(scenes)
        groups = [AcquisitionGroup(group_id=stable_id(g["metadata"]), **g) for g in raw_groups]
        pairmap = {(p["before"], p["after"]): [] for p in pairs}
        for a in analyses:
            pairmap.setdefault(tuple(s.scene_id for s in a.scenes), []).append(a)
        comparisons = []
        events = {}
        for (before, after), items in pairmap.items():
            b, e = observations[before], observations[after]
            group = next(g for g in groups if before in g.scene_ids)
            summaries = {
                a.analysis_id: {lng: self.story(a, lng).summary for lng in ("pt", "en")}
                for a in items
            }
            comparisons.append(
                Comparison(
                    comparison_id=stable_id([area_id, before, after]),
                    before_scene_id=before,
                    after_scene_id=after,
                    before_time=b.start_time,
                    after_time=e.start_time,
                    group_id=group.group_id,
                    track=b.track,
                    frame=b.frame,
                    direction=b.direction,
                    analysis_ids=[a.analysis_id for a in items],
                    availability="available" if items else "not_processed",
                    statistics={a.analysis_id: self.statistics(a) for a in items},
                    layers={a.analysis_id: self.layers(a) for a in items},
                    summaries=summaries,
                    narrative_ids={a.analysis_id: self.story(a, lang).narrative_id for a in items},
                    links={a.analysis_id: f"/api/v1/analyses/{a.analysis_id}" for a in items},
                )
            )
            for a in items:
                for event in a.provenance.get("hydrological_context", []):
                    events[stable_id(event)] = {
                        **event,
                        "role": "regional_context_not_pixel_validation",
                    }
        comparisons.sort(key=lambda c: (c.after_time, c.comparison_id))
        data_status = (
            "no_data"
            if not scenes
            else "synthetic"
            if all(s.synthetic for s in scenes)
            else "mixed"
            if any(s.synthetic for s in scenes)
            else "real"
        )
        summary = (
            f"{len(scenes)} observações, {len(comparisons)} comparações e {len(groups)} grupos de aquisição. Não foi inferida uma tendência ambiental."
            if lang == "pt"
            else f"{len(scenes)} observations, {len(comparisons)} comparisons and {len(groups)} acquisition groups. No environmental trend was inferred."
        )
        return Timeline(
            area_id=area_id,
            scene_count=len(scenes),
            comparison_count=len(comparisons),
            analysis_count=len(analyses),
            observations=scenes,
            comparisons=comparisons,
            groups=groups,
            events=list(events.values()),
            interpretation=TemporalInterpretation(
                language=lang, summary=summary, limitations=LIMITATIONS[lang]
            ),
            data_status=data_status,
        )

    def overview(self, area_id, lang="pt", exclude_synthetic=False):
        area = self.area(area_id)
        timeline = self.timeline(area_id, lang, exclude_synthetic)
        analyses = self.analyses(area_id, exclude_synthetic)
        stats = [self.statistics(a).general_change.statistics for a in analyses]
        lows = [s["min_delta_db"] for s in stats if s and s.get("min_delta_db") is not None]
        highs = [s["max_delta_db"] for s in stats if s and s.get("max_delta_db") is not None]
        available = sum(c.availability == "available" for c in timeline.comparisons)
        state = (
            "no_observations"
            if not timeline.observations
            else "no_compatible_pairs"
            if not timeline.comparisons
            else "not_processed"
            if not available
            else "partially_available"
            if available < timeline.comparison_count
            else "available"
        )
        return Overview(
            area_id=area_id,
            area=area,
            summary=timeline.interpretation.summary,
            scene_count=timeline.scene_count,
            comparison_count=timeline.comparison_count,
            analysis_count=len(analyses),
            group_count=len(timeline.groups),
            period_start=timeline.observations[0].start_time if timeline.observations else None,
            period_end=timeline.observations[-1].start_time if timeline.observations else None,
            latest_observation=timeline.observations[-1] if timeline.observations else None,
            analysis_types=["open_water"]
            + (["general_change", "radar_increase", "radar_decrease"] if any(stats) else [])
            if analyses
            else [],
            availability=state,
            valid_coverage_km2_by_analysis={
                a.analysis_id: a.statistics.get("valid_area_km2") for a in analyses
            },
            change_range_db={
                "min": min(lows) if lows else None,
                "max": max(highs) if highs else None,
            },
            comparisons_with_water_candidates=sum(
                any(
                    (s.open_water.statistics or {}).get("candidate_pixels", 0) > 0
                    for s in c.statistics.values()
                )
                for c in timeline.comparisons
            ),
            temporal_summary=timeline.interpretation,
            warnings=LIMITATIONS[lang],
            links={
                "timeline": f"/api/v1/areas/{area_id}/timeline",
                "analyses": f"/api/v1/analyses?area_id={area_id}",
            },
            data_status=timeline.data_status,
        )
