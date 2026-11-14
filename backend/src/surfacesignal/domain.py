from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from shapely.geometry import shape


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class AreaConfig(Model):
    area_id: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str
    geometry: dict[str, Any]
    source_url: str
    description: str = ""
    crs: Literal["EPSG:4326"] = "EPSG:4326"
    max_pixels: int = Field(default=4_000_000, gt=0, le=20_000_000)

    @field_validator("geometry")
    @classmethod
    def polygon(cls, value):
        geom = shape(value)
        if geom.geom_type not in ("Polygon", "MultiPolygon") or not geom.is_valid or geom.is_empty:
            raise ValueError("AOI must be a valid nonempty polygon")
        if not (
            -180 <= geom.bounds[0] < geom.bounds[2] <= 180
            and -90 <= geom.bounds[1] < geom.bounds[3] <= 90
        ):
            raise ValueError("AOI coordinates must be longitude/latitude")
        return value


class Scene(Model):
    scene_id: str = Field(pattern=r"^[A-Za-z0-9_.-]+$")
    area_id: str
    start_time: datetime
    track: int | None = None
    frame: int | None = None
    direction: str | None = None
    mode: str | None = None
    polarization: str | None = None
    release: str | None = None
    maturity: str | None = None
    url: str | None = None
    size_bytes: int | None = Field(default=None, gt=0)
    geometry: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    synthetic: bool = False

    @field_validator("start_time")
    @classmethod
    def utc(cls, value):
        if value.tzinfo is None:
            raise ValueError("Acquisition time must include a timezone")
        return value.astimezone(UTC)


class SceneAvailability(Scene):
    local_available: bool


class CatalogSnapshot(Model):
    area_id: str
    scenes: list[Scene]
    query: dict[str, Any] = Field(default_factory=dict)
    accessed_at: datetime | None = None
    complete: bool = True


def comparable(before: Scene, after: Scene) -> bool:
    keys = ("track", "frame", "direction", "mode", "polarization", "release")
    return (
        before.start_time < after.start_time
        and before.area_id == after.area_id
        and all(
            getattr(before, k) is not None and getattr(before, k) == getattr(after, k) for k in keys
        )
    )


def shortlist(scenes: list[Scene], event: datetime) -> list[dict]:
    pairs = []
    for a in scenes:
        for b in scenes:
            if comparable(a, b) and a.start_time < event <= b.start_time:
                pairs.append(
                    {
                        "before": a.scene_id,
                        "after": b.scene_id,
                        "distance_seconds": (b.start_time - a.start_time).total_seconds(),
                    }
                )
    return sorted(pairs, key=lambda p: (p["distance_seconds"], p["before"], p["after"]))


class Evidence(Model):
    observation: str
    interpretation: str
    confidence_level: Literal["not_established"] = "not_established"
    validation_status: Literal["not_validated"] = "not_validated"
    reason: str = "No contemporaneous independent spatial reference was aligned."
    references_attempted: list[str] = Field(default_factory=list)
    alternative_explanations: list[str]
    limitations: list[str]
    sources: list[str]
    provenance: dict[str, Any]
    is_operational_alert: Literal[False] = False
    synthetic: bool


class Analysis(Model):
    analysis_id: str = Field(pattern=r"^[a-zA-Z0-9-]+$")
    area_id: str
    status: Literal["completed"] = "completed"
    synthetic: bool
    scenes: list[Scene]
    parameters: dict[str, Any]
    statistics: dict[str, Any]
    provenance: dict[str, Any]
    artifacts: dict[str, str]
    evidence: Evidence


class DataSource(Model):
    source_id: str
    name: str
    organization: str
    url: str
    use: str
    terms: str


class Page[T](Model):
    items: list[T]
    total: int
    offset: int
    limit: int
