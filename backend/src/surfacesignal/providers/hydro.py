import csv
from datetime import UTC, datetime
from pathlib import Path

from pydantic import Field, HttpUrl, field_validator

from surfacesignal.domain import Model


class HydroRecord(Model):
    station: str = Field(min_length=1)
    observed_at: datetime
    level_m: float | None = None
    source_url: HttpUrl
    note: str = ""

    @field_validator("observed_at")
    @classmethod
    def utc(cls, value):
        if value.tzinfo is None:
            raise ValueError("Hydrology time requires an explicit timezone")
        return value.astimezone(UTC)


def read_records(path: Path) -> list[HydroRecord]:
    with path.open(newline="") as file:
        return [
            HydroRecord(**(row | {"level_m": row["level_m"] or None}))
            for row in csv.DictReader(file)
        ]


def context_for(records: list[HydroRecord], acquisition: datetime, max_hours=24) -> list[dict]:
    result = []
    for record in records:
        hours = (record.observed_at - acquisition).total_seconds() / 3600
        if abs(hours) <= max_hours:
            result.append(
                record.model_dump(mode="json")
                | {
                    "time_offset_hours": hours,
                    "role": "hydrological_context_not_spatial_validation",
                }
            )
    return sorted(result, key=lambda r: (abs(r["time_offset_hours"]), r["station"]))


def reference_status(source_url, time_offset_hours, max_hours=24):
    if source_url is None:
        return {"validation_status": "not_validated", "reason": "No independent reference supplied"}
    if abs(time_offset_hours) > max_hours:
        return {
            "validation_status": "context_only",
            "reason": "Reference outside configured temporal tolerance",
        }
    return {
        "validation_status": "eligible_for_comparison",
        "reason": "Requires spatial alignment, quality masks and documented class mapping; not ground truth",
    }
