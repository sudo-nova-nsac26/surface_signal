from datetime import datetime
from typing import Literal

from pydantic import Field, HttpUrl, field_validator

from surfacesignal.domain import Model

Audience = Literal["residents", "municipal"]


class Budgets(Model):
    max_input_bytes: int = Field(default=25_000_000, gt=0, strict=True)
    max_features: int = Field(default=50_000, gt=0, strict=True)
    max_coordinates: int = Field(default=1_000_000, gt=0, strict=True)
    max_output_bytes: int = Field(default=25_000_000, gt=0, strict=True)


class ContextSource(Model):
    source_url: HttpUrl
    publisher: str = Field(min_length=1)
    retrieved_at: datetime
    reference_date: str = Field(min_length=1)
    version: str = Field(min_length=1)
    usage_statement: str = Field(min_length=1)
    synthetic: bool = False

    @field_validator("retrieved_at")
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None:
            raise ValueError("Retrieval timestamp requires timezone")
        return value


class GuidanceSource(Model):
    source_id: str
    title: str
    publisher: str
    url: str
    retrieved_on: str
    locator: str
    applicability: str


class Action(Model):
    action_id: str
    audience: Audience
    objective: str
    task: str
    reason: str
    basis: Literal["general_guidance", "observed_overlap"]
    origin: Literal["official_guidance_paraphrase", "surfacesignal_proposal"]
    evidence_ids: list[str]
    source_ids: list[str]
    feature_id: str | None = None
    suggested_role: str | None = None
    status: Literal["proposed"] = "proposed"
    review_status: Literal["human_review_required"] = "human_review_required"
    rule_version: str = "preparation-v1"


class LocalRelation(Model):
    feature_id: str
    name: str
    kind: str
    geometry_type: Literal["Point", "Polygon", "MultiPolygon"]
    intersects: Literal[True] | None
    overlap_km2: float | None = Field(default=None, ge=0)
    coverage: Literal["unknown"] = "unknown"
    layer: Literal["general_change", "open_water"]


class Observation(Model):
    analysis_id: str
    before_time: datetime
    after_time: datetime
    group: dict
    parameters: dict
    general_parameters: dict | None
    valid_area_km2: float | None = Field(ge=0)
    changed_area_km2: float | None = Field(ge=0)
    water_candidate_area_km2: float | None = Field(ge=0)
    summary: str
    interpretation: str
    alternative_explanations: list[str]
    limitations: list[str]
    sources: list[str]
    local_relations: list[LocalRelation] | None
    provenance: dict


class LocalReport(Model):
    area_id: str
    area_name: str
    language: Literal["pt", "en"]
    title: str
    notice: str
    data_status: Literal["real", "synthetic", "no_data"]
    context_status: Literal["available", "unavailable"]
    context_source: dict | None
    observations: list[Observation]
    limitations: list[str]
    provenance: dict
    validation_status: Literal["not_validated"] = "not_validated"
    is_operational_alert: Literal[False] = False


class PreparationPlan(Model):
    area_id: str
    area_name: str
    language: Literal["pt", "en"]
    audience: Audience
    title: str
    notice: str
    data_status: Literal["real", "synthetic", "no_data"]
    status: Literal["proposed"] = "proposed"
    actions: list[Action]
    sources: list[GuidanceSource]
    limitations: list[str]
    provenance: dict
    validation_status: Literal["not_validated"] = "not_validated"
    is_operational_alert: Literal[False] = False
