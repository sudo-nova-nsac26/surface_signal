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
