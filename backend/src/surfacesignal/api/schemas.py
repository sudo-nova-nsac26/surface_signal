from datetime import datetime
from typing import Any, Literal

from surfacesignal.domain import AreaConfig, Model, Scene
from surfacesignal.interpretation.models import Language, Localized


class Layer(Model):
    layer_id: str
    name: Localized
    description: Localized
    status: str
    geometry_type: str = "Polygon"
    legend: list[dict[str, str]]
    measurement: str
    artifact_url: str | None
    method: str
    available: bool
    limitations: Localized
    validation_status: Literal["not_validated"] = "not_validated"


class LayerIndex(Model):
    analysis_id: str | None = None
    items: list[Layer]


class CapabilityStatistics(Model):
    status: Literal["available", "unavailable"]
    method: str
    units: dict[str, str]
    parameters: dict[str, Any] | None
    statistics: dict[str, Any] | None
    derived_id: str | None = None
    validation_status: Literal["not_validated"] = "not_validated"


class Statistics(Model):
    analysis_id: str
    general_change: CapabilityStatistics
    open_water: CapabilityStatistics


class Comparison(Model):
    comparison_id: str
    before_scene_id: str
    after_scene_id: str
    before_time: datetime
    after_time: datetime
    group_id: str
    track: int | None
    frame: int | None
    direction: str | None
    analysis_ids: list[str]
    availability: Literal["available", "not_processed"]
    statistics: dict[str, Statistics]
    layers: dict[str, LayerIndex]
    summaries: dict[str, dict[Language, str]]
    narrative_ids: dict[str, str]
    links: dict[str, str]
    validation_status: Literal["not_validated"] = "not_validated"


class AcquisitionGroup(Model):
    group_id: str
    metadata: dict[str, Any]
    scene_ids: list[str]
    acquisition_representatives: list[str]
    status: str
    reason: str | None


class TemporalInterpretation(Model):
    language: Language
    summary: str
    limitations: list[str]
    spatial_aggregation: Literal["not_computed"] = "not_computed"
    continuous_environmental_trend: Literal["not_inferred"] = "not_inferred"


class Timeline(Model):
    area_id: str
    scene_count: int
    comparison_count: int
    analysis_count: int
    observations: list[Scene]
    comparisons: list[Comparison]
    groups: list[AcquisitionGroup]
    events: list[dict[str, Any]]
    interpretation: TemporalInterpretation
    data_status: Literal["real", "synthetic", "mixed", "no_data"]


class Overview(Model):
    area_id: str
    area: AreaConfig
    summary: str
    scene_count: int
    comparison_count: int
    analysis_count: int
    group_count: int
    period_start: datetime | None
    period_end: datetime | None
    latest_observation: Scene | None
    analysis_types: list[str]
    availability: Literal[
        "no_observations",
        "no_compatible_pairs",
        "not_processed",
        "partially_available",
        "available",
    ]
    valid_coverage_km2_by_analysis: dict[str, float | None]
    change_range_db: dict[str, float | None]
    comparisons_with_water_candidates: int
    temporal_summary: TemporalInterpretation
    warnings: list[str]
    links: dict[str, str]
    data_status: Literal["real", "synthetic", "mixed", "no_data"]
    area_semantics: str = (
        "Configured AOI geometry; valid coverage is measured separately for each comparison."
    )
