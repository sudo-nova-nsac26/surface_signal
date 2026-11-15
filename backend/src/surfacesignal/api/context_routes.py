"""Prepared environmental resources only; no provider calls during GET."""

from datetime import UTC, date, datetime, time

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from surfacesignal.context.models import (
    ContextSource,
    ContextValidation,
    EnvironmentalContextReport,
    EnvironmentalEvent,
    ReferenceLayers,
)
from surfacesignal.context.store import (
    ContextNotPrepared,
    area_events,
    area_reference_layers,
    load_context,
)
from surfacesignal.domain import Page
from surfacesignal.providers.environmental import context_sources


def context_router(settings):
    router = APIRouter(prefix="/api/v1", tags=["Environmental context"])

    def prepared(analysis_id, name):
        try:
            return load_context(settings, analysis_id)["payloads"][name]
        except ContextNotPrepared:
            return JSONResponse(
                status_code=404,
                content={
                    "error": {
                        "code": "context_not_prepared",
                        "message": "Environmental context has not been prepared.",
                    }
                },
            )

    @router.get(
        "/analyses/{analysis_id}/environmental-context", response_model=EnvironmentalContextReport
    )
    def report(analysis_id: str):
        return prepared(analysis_id, "environmental-context.json")

    @router.get("/analyses/{analysis_id}/validation", response_model=ContextValidation)
    def validation(analysis_id: str):
        return prepared(analysis_id, "validation.json")

    @router.get("/areas/{area_id}/environmental-events", response_model=Page[EnvironmentalEvent])
    def events(
        area_id: str,
        start: date | None = None,
        end: date | None = None,
        offset: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
    ):
        if start and end and start > end:
            raise HTTPException(422, "start must not exceed end")
        values = area_events(settings, area_id)
        values = [
            v
            for v in values
            if (
                not start
                or datetime.fromisoformat(v["observed_at"].replace("Z", "+00:00"))
                >= datetime.combine(start, time.min, UTC)
            )
            and (
                not end
                or datetime.fromisoformat(v["observed_at"].replace("Z", "+00:00"))
                <= datetime.combine(end, time.max, UTC)
            )
        ]
        return {
            "items": values[offset : offset + limit],
            "offset": offset,
            "limit": limit,
            "total": len(values),
        }

    @router.get("/areas/{area_id}/reference-layers", response_model=ReferenceLayers)
    def references(area_id: str):
        return area_reference_layers(settings, area_id)

    @router.get("/context/sources", response_model=Page[ContextSource])
    def sources(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        values = context_sources()
        return {
            "items": values[offset : offset + limit],
            "total": len(values),
            "offset": offset,
            "limit": limit,
        }

    return router
