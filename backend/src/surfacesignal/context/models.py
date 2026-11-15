"""Additive public contracts and explicit local-import provenance."""

from datetime import UTC, datetime
from typing import Any, Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator, model_validator

from surfacesignal.domain import Model

Availability = Literal["available", "partial", "unavailable", "not_checked"]
Role = Literal[
    "sensor_observation",
    "historical_context",
    "environmental_context",
    "independent_reference",
    "official_guidance",
]


def utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("Timezone is required")
    return value.astimezone(UTC)


def public_url(value: str) -> str:
    parsed = urlsplit(value)
    # Inputs are citation URLs, never authentication or download URLs.
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Use a public HTTPS citation without credentials, query or fragment")
    return value


class ContextBudgets(Model):
    max_input_bytes: int = Field(default=25_000_000, gt=0, le=500_000_000)
    max_output_bytes: int = Field(default=25_000_000, gt=0, le=100_000_000)
    max_pixels: int = Field(default=1_000_000, gt=0, le=4_000_000)
    max_records: int = Field(default=50_000, gt=0, le=200_000)


class ContextDataset(Model):
    source_id: str
    provider: str
    dataset_id: str
    dataset_version: str
    retrieved_at: datetime
    observed_start: datetime
    observed_end: datetime
    source_url: str
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    crs: str
    spatial_resolution_m: float | None = Field(default=None, gt=0)
    temporal_resolution_seconds: int | None = Field(default=None, gt=0)
    native_unit: str
    normalized_unit: str
    license_id: str
    redistribution_allowed: bool
    synthetic: bool
    quality_flags: list[str] = []
    limitations: list[str] = []
    parameters: dict[str, Any] = {}

    _times = field_validator("retrieved_at", "observed_start", "observed_end")(utc)
    _url = field_validator("source_url")(public_url)

    @model_validator(mode="after")
    def interval(self):
        if set(self.parameters) & set(type(self).model_fields):
            raise ValueError("Parameters cannot override canonical dataset provenance")
        if self.observed_start > self.observed_end:
            raise ValueError("Invalid observation interval")
        return self


class HydroObservation(Model):
    station_id: str
    station_name: str
    observed_at: datetime
    parameter: Literal["river_level", "rainfall", "discharge"]
    value: float | None
    unit: str
    native_unit: str
    original_timezone: str
    quality_status: str
    method: str
    datum: str | None = None
    longitude: float | None = Field(default=None, ge=-180, le=180)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    source_id: str
    synthetic: bool
    time_offset_hours: float | None = None
    _time = field_validator("observed_at")(utc)


class RainInterval(Model):
    start: datetime
    end: datetime
    value: float | None = Field(default=None, ge=0)
    unit: Literal["mm/h", "mm"]
    quality_status: Literal["valid", "rejected", "missing"]
    _times = field_validator("start", "end")(utc)

    @model_validator(mode="after")
    def interval(self):
        if self.start >= self.end:
            raise ValueError("Rain interval must have positive duration")
        return self


class EvidenceSource(Model):
    source_id: str
    name: str
    url: str
    product: str | None = None
    dataset_version: str | None = None
    license_id: str | None = None
    reference_year: int | None = None
    observed_start: datetime | None = None
    observed_end: datetime | None = None
    resolution_m: float | None = None
    synthetic: bool
    redistribution_allowed: bool
    limitations: list[str] = []
    _url = field_validator("url")(public_url)


class RainfallContext(Model):
    status: Availability = "unavailable"
    source_id: str = "gpm-imerg"
    product: str | None = None
    run: Literal["early", "late", "final"] | None = None
    resolution_km_approx: float | None = None
    windows_mm: dict[str, float | None] = {"24h": None, "48h": None, "72h": None}
    coverage_fraction: float | None = None
    coverage_by_window: dict[str, float] = {}
    acquisitions: dict[str, dict[str, Any]] = {}
    limitations: list[str] = []


class HydrologyContext(Model):
    status: Availability = "unavailable"
    stations: list[dict[str, Any]] = []
    records: list[HydroObservation] = []
    limitations: list[str] = []


class SpatialContext(Model):
    coverage_fraction: float | None = Field(default=None, ge=0, le=1)
    valid_area_km2: float | None = Field(default=None, ge=0)
    aggregation: str | None = None
    aggregation_scope: str = "configured_aoi"


class HistoricalWater(SpatialContext):
    status: Availability = "unavailable"
    reference_year: int | None = None
    collection: str = "MapBiomas Água Coleção 5"
    overlap_km2: float | None = None
    overlap_fraction: float | None = None
    limitations: list[str] = []


class LandClass(Model):
    class_id: str
    label: str
    percent: float | None


class LandCover(SpatialContext):
    status: Availability = "unavailable"
    reference_year: int | None = None
    classes: list[LandClass] = []
    limitations: list[str] = []


class Topography(SpatialContext):
    status: Availability = "unavailable"
    elevation_m: float | None = None
    slope_deg: float | None = None
    limitations: list[str] = []


class ContextValidation(Model):
    status: str = "not_validated"
    reference_id: str | None = None
    reference: dict[str, Any] | None = None
    metrics: dict[str, float | None] | None = None
    coverage: dict[str, Any] | None = None
    limitations: list[str] = ["No qualified independent spatial reference."]
    provenance: dict[str, Any] = {}


class ReferenceLayer(Model):
    layer_id: str
    status: Availability
    title: str
    role: Role
    reference_year: int | None = None
    legend: list[dict[str, Any]] = []
    artifact_url: str | None = None
    source_id: str
    limitations: list[str] = []
    redistribution_allowed: bool = False
    synthetic: bool = False


class ReferenceLayers(Model):
    area_id: str
    items: list[ReferenceLayer]


class EnvironmentalEvent(Model):
    event_id: str
    source_id: str
    kind: Literal["station_measurement", "rainfall_window", "bulletin", "reference"]
    observed_at: datetime
    observed_start: datetime | None = None
    observed_end: datetime | None = None
    station_id: str | None = None
    station_name: str | None = None
    parameter: str | None = None
    value: float | None = None
    unit: str | None = None
    synthetic: bool
    quality_status: str
    analysis_id: str | None = None
    _time = field_validator("observed_at")(utc)


class EnvironmentalContextReport(Model):
    schema_version: Literal["1.0"] = "1.0"
    area_id: str
    analysis_id: str
    observed_at: datetime
    generated_at: datetime
    data_status: Availability
    synthetic: bool
    rainfall: RainfallContext = RainfallContext()
    hydrology: HydrologyContext = HydrologyContext()
    historical_water: HistoricalWater = HistoricalWater()
    land_cover: LandCover = LandCover()
    topography: Topography = Topography()
    validation: ContextValidation = ContextValidation()
    sources: list[EvidenceSource] = []
    limitations: list[str] = ["Environmental context does not confirm flooding."]
    is_operational_alert: Literal[False] = False
    provenance: dict[str, Any]


class QualifiedReference(Model):
    reference_geometry: dict[str, Any]
    valid_coverage: dict[str, Any]
    reference_at: datetime
    independent: bool
    quality_verified: bool
    method: str = Field(min_length=1)
    class_mapping: dict[str, int | str]
    _time = field_validator("reference_at")(utc)

    @field_validator("reference_geometry", "valid_coverage")
    @classmethod
    def geometry(cls, value):
        from surfacesignal.context.spatial import _geometry

        _geometry(value)
        return value


class ContextSource(Model):
    source_id: str
    name: str
    url: str
    role: Role
    integration_status: Literal[
        "registered", "discovery_only", "import_ready", "integrated", "blocked"
    ]
    terms_url: str
    coverage_period: str | None
    redistribution_allowed: bool
    limitations: list[str]
    update_note: str
