from typing import Any, Literal

from pydantic import Field

from surfacesignal.domain import Model

Language = Literal["pt", "en"]


class Localized(Model):
    pt: str
    en: str


class Capability(Model):
    capability_id: str
    name: Localized
    description: Localized
    scientific_method: str
    required_data: list[str]
    available_data: list[str]
    implementation_status: Literal["implemented", "experimental", "exploratory", "unavailable"]
    result_type: Literal["observation", "thematic_candidates", "explanation_only", "unavailable"]
    limitations: Localized
    dependencies: list[str]
    validation_status: Literal["not_validated"] = "not_validated"


class Metric(Model):
    key: str
    label: str
    value: float | int | None
    unit: str


class Story(Model):
    analysis_id: str
    language: Language
    narrative_id: str
    title: str
    summary: str
    observation: str
    result: str
    interpretation: str
    water_interpretation: str
    general_state: Literal[
        "insufficient_data", "no_candidates", "small_changes", "changes", "extensive_changes"
    ]
    water_state: Literal["insufficient_data", "no_candidates", "candidates_identified"]
    alternative_explanations: list[str]
    limitations: list[str]
    key_metrics: list[Metric]
    methodology: dict[str, Any]
    sources: list[str]
    synthetic: bool
    data_status: Literal["synthetic", "real"]
    validation_status: Literal["not_validated"] = "not_validated"
    is_operational_alert: Literal[False] = False


class InstitutionalStory(Model):
    story_id: str
    title: str
    text: str
    sources: list[str]


class Stories(Model):
    language: Language
    items: list[InstitutionalStory]
    content_version: str = "1.0.0"


class Methodology(Model):
    methodology_id: str = "surface-signal-mvp-v1"
    measurement: str = "gamma0_db"
    expression: str = "delta_gamma0_db = after_gamma0_db - before_gamma0_db"
    stages: list[str]
    methods: dict[str, Any]
    limitations: Localized
    sources: list[str]
    validation_status: Literal["not_validated"] = "not_validated"
    is_operational_alert: Literal[False] = False
    examples: list[dict[str, Any]] = Field(default_factory=list)
