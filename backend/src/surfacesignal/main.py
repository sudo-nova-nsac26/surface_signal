import json
from datetime import UTC, date, datetime, time
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError

from surfacesignal.api.routes import router
from surfacesignal.api.service import Repository, StoreUnavailable
from surfacesignal.config import Settings
from surfacesignal.domain import (
    Analysis,
    AreaConfig,
    DataSource,
    Evidence,
    Page,
    SceneAvailability,
)
from surfacesignal.processing.general_change import DERIVED_ARTIFACT_NAMES
from surfacesignal.processing.pipeline import ARTIFACT_NAMES
from surfacesignal.providers.sources import SOURCES


def load_areas(settings):
    return Repository(settings).areas()


def load_scenes(settings):
    return Repository(settings).scenes()


class AnalysisResponse(Analysis):
    derived: dict | None = None
    links: dict[str, str] = {}


def create_app(settings=None):
    settings = settings or Settings()
    repo = Repository(settings)
    app = FastAPI(
        title="SurfaceSignal API",
        version="0.2.0",
        description=(
            "Understand Earth surface changes from prepared NISAR GCOV gamma0 observations. "
            "Radar observation → change detection → environmental hypothesis → independent validation. "
            "Thresholds are heuristic; processing completion does not establish scientific validation. "
            "Read-only, no downloads or heavy processing in requests. "
            "See /api/v1/methodology and /api/v1/sources. Synthetic examples are explicitly labelled."
        ),
        openapi_tags=[
            {"name": name}
            for name in [
                "Health",
                "Areas",
                "Scenes",
                "Analyses",
                "Timeline",
                "Layers",
                "Stories",
                "Science",
                "Sources",
            ]
        ],
        responses={
            404: {"description": "Prepared resource not found"},
            422: {"description": "Invalid path or query parameter"},
            503: {"description": "Prepared store unavailable or invalid"},
        },
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["Accept"],
    )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": str(exc.status_code), "message": exc.detail}},
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {"code": "invalid_request", "message": "Invalid path or query parameter"}
            },
        )

    async def corrupt_store(request: Request, exc: Exception):
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "store_unavailable",
                    "message": "Prepared data is unavailable or invalid; inspect local catalog/manifests",
                }
            },
        )

    for exception in (OSError, json.JSONDecodeError, ValidationError, StoreUnavailable, KeyError):
        app.add_exception_handler(exception, corrupt_store)

    def page(items, offset, limit):
        return {
            "items": items[offset : offset + limit],
            "total": len(items),
            "offset": offset,
            "limit": limit,
        }

    @app.exception_handler(FileNotFoundError)
    async def missing_resource(request: Request, exc: FileNotFoundError):
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "404", "message": "Prepared resource not found"}},
        )

    @app.exception_handler(ValueError)
    async def invalid_identifier(request: Request, exc: ValueError):
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "404", "message": "Prepared resource not found"}},
        )

    def get_analysis(identifier):
        return repo.analysis(identifier)

    science_routes = router(repo)
    app.include_router(science_routes)

    @app.get("/health", tags=["Health"], summary="Service health without raw data access")
    def health():
        return {"status": "ok", "service": "surfacesignal", "operational_alerts": False}

    @app.get("/api/v1/areas", response_model=Page[AreaConfig], tags=["Areas"])
    def areas(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        return page(load_areas(settings), offset, limit)

    @app.get("/api/v1/areas/{area_id}", response_model=AreaConfig, tags=["Areas"])
    def area(area_id: str):
        for item in load_areas(settings):
            if item.area_id == area_id:
                return item
        raise HTTPException(404, "Area not found")

    def scene_availability(item):
        return repo.scene_availability(item)

    @app.get("/api/v1/scenes", response_model=Page[SceneAvailability], tags=["Scenes"])
    def scenes(
        area_id: str | None = None,
        start: date | None = None,
        end: date | None = None,
        offset: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
    ):
        if start and end and start > end:
            raise HTTPException(422, "start must not exceed end")
        if area_id:
            area(area_id)
        values = [
            s
            for s in load_scenes(settings)
            if (not area_id or s.area_id == area_id)
            and (not start or s.start_time >= datetime.combine(start, time.min, UTC))
            and (not end or s.start_time <= datetime.combine(end, time.max, UTC))
        ]
        return page(
            [
                scene_availability(s)
                for s in sorted(values, key=lambda s: (s.start_time, s.scene_id))
            ],
            offset,
            limit,
        )

    @app.get("/api/v1/scenes/{scene_id}", response_model=SceneAvailability, tags=["Scenes"])
    def scene(scene_id: str):
        for item in load_scenes(settings):
            if item.scene_id == scene_id:
                return scene_availability(item)
        raise HTTPException(404, "Scene not found")

    @app.get("/api/v1/analyses", response_model=Page[Analysis], tags=["Analyses"])
    def analyses(
        area_id: str | None = None,
        offset: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
        exclude_synthetic: bool = False,
        sort_by: Literal["date", "changed_area", "magnitude", "components", "acquisition"] = Query(
            "date", description="Ordering, never a severity or risk ranking"
        ),
    ):
        return page(repo.analyses(area_id, exclude_synthetic, sort_by), offset, limit)

    @app.get("/api/v1/analyses/{analysis_id}", response_model=AnalysisResponse, tags=["Analyses"])
    def analysis(analysis_id: str):
        item = get_analysis(analysis_id)
        return AnalysisResponse(
            **item.model_dump(),
            derived=repo.derived(item),
            links={
                key: f"/api/v1/analyses/{analysis_id}/{key}"
                for key in ["statistics", "layers", "story", "evidence"]
            },
        )

    @app.get("/api/v1/analyses/{analysis_id}/evidence", response_model=Evidence, tags=["Analyses"])
    def evidence(analysis_id: str):
        return get_analysis(analysis_id).evidence

    @app.get(
        "/api/v1/analyses/{analysis_id}/artifacts", response_model=dict[str, str], tags=["Analyses"]
    )
    def artifacts(analysis_id: str):
        item = get_analysis(analysis_id)
        derived = repo.derived(item)
        names = (
            set(item.artifacts)
            | {"manifest.json"}
            | (set(derived["artifacts"]) if derived else set())
        )
        return {
            name: f"/api/v1/analyses/{analysis_id}/artifacts/{name}"
            for name in sorted(names)
            if name in ARTIFACT_NAMES | DERIVED_ARTIFACT_NAMES
        }

    @app.get(
        "/api/v1/analyses/{analysis_id}/artifacts/{name}",
        tags=["Analyses"],
        summary="Read an allowlisted prepared artifact",
    )
    def artifact(analysis_id: str, name: str):
        try:
            path = repo.artifact_path(analysis_id, name)
        except StoreUnavailable:
            raise HTTPException(404, "Artifact not found") from None
        a = get_analysis(analysis_id)
        d = repo.derived(a) if name in DERIVED_ARTIFACT_NAMES and name != "manifest.json" else None
        digest = (d["artifacts"] if d else a.artifacts).get(name)
        headers = {"Cache-Control": "public, max-age=0, must-revalidate"}
        if digest:
            headers["ETag"] = f'"{digest}"'
        return FileResponse(path, filename=name, headers=headers)

    @app.get("/api/v1/sources", response_model=Page[DataSource], tags=["Sources"])
    def sources(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        return page(SOURCES, offset, limit)

    # FastAPI's OpenAPI model serialization drops None recursively, including values
    # inside response examples. Restore explicit nulls: unavailable is not zero/omitted.
    original_openapi = app.openapi

    def documented_openapi():
        schema = original_openapi()
        for route in science_routes.routes:
            for code, response in getattr(route, "responses", {}).items():
                examples = response.get("content", {}).get("application/json", {}).get("examples")
                if examples:
                    for method in route.methods:
                        schema["paths"][route.path][method.lower()]["responses"][str(code)][
                            "content"
                        ]["application/json"]["examples"] = examples
        return schema

    app.openapi = documented_openapi

    return app


app = create_app()
