from fastapi import APIRouter, Query

from surfacesignal.api.examples import example
from surfacesignal.api.schemas import LayerIndex, Overview, Statistics, Timeline
from surfacesignal.domain import Page
from surfacesignal.interpretation.engine import institutional_stories, methodology
from surfacesignal.interpretation.models import Capability, Language, Methodology, Stories, Story
from surfacesignal.processing.capabilities import capabilities


def router(repo):
    routes = APIRouter(prefix="/api/v1")

    @routes.get(
        "/capabilities",
        response_model=Page[Capability],
        responses=example("capabilities"),
        tags=["Science"],
        summary="Scientific capabilities and evidence requirements",
    )
    def scientific_capabilities(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        items = capabilities()
        return {
            "items": items[offset : offset + limit],
            "total": len(items),
            "offset": offset,
            "limit": limit,
        }

    @routes.get(
        "/methodology",
        response_model=Methodology,
        responses=example("methodology"),
        tags=["Science"],
        summary="Methods, heuristic thresholds and limitations",
    )
    def scientific_method():
        return methodology()

    @routes.get(
        "/stories",
        response_model=Stories,
        responses=example("stories"),
        tags=["Stories"],
        summary="Accessible institutional explanations in Portuguese or English",
    )
    def stories(lang: Language = "pt"):
        return institutional_stories(lang)

    @routes.get(
        "/layers",
        response_model=LayerIndex,
        responses=example("layers"),
        tags=["Layers"],
        summary="Conceptual layer catalog; availability is analysis-specific",
    )
    def layers():
        return repo.layers()

    @routes.get(
        "/areas/{area_id}/overview",
        response_model=Overview,
        responses=example("overview"),
        tags=["Areas"],
        summary="Regional history and per-comparison valid coverage",
    )
    def overview(area_id: str, lang: Language = "pt", exclude_synthetic: bool = False):
        return repo.overview(area_id, lang, exclude_synthetic)

    @routes.get(
        "/areas/{area_id}/timeline",
        response_model=Timeline,
        responses=example("timeline"),
        tags=["Timeline"],
        summary="Observations and comparisons grouped by compatible acquisition",
    )
    def timeline(area_id: str, lang: Language = "pt", exclude_synthetic: bool = False):
        return repo.timeline(area_id, lang, exclude_synthetic)

    @routes.get(
        "/analyses/{analysis_id}/statistics",
        response_model=Statistics,
        responses=example("statistics"),
        tags=["Analyses"],
        summary="Measured statistics per capability with units and parameters",
    )
    def statistics(analysis_id: str):
        return repo.statistics(repo.analysis(analysis_id))

    @routes.get(
        "/analyses/{analysis_id}/layers",
        response_model=LayerIndex,
        responses=example("layers"),
        tags=["Layers"],
        summary="Available and unavailable analysis layers",
    )
    def analysis_layers(analysis_id: str):
        return repo.layers(repo.analysis(analysis_id))

    @routes.get(
        "/analyses/{analysis_id}/story",
        response_model=Story,
        responses=example("story"),
        tags=["Stories"],
        summary="Deterministic interpretation with measured metrics and provenance",
    )
    def story(analysis_id: str, lang: Language = "pt"):
        return repo.story(repo.analysis(analysis_id), lang)

    return routes
