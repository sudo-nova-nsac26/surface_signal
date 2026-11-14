import json
from datetime import UTC, date, datetime, time

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError

from surfacesignal.config import Settings
from surfacesignal.domain import (
    Analysis,
    AreaConfig,
    CatalogSnapshot,
    DataSource,
    Evidence,
    Page,
    SceneAvailability,
)
from surfacesignal.processing.pipeline import ARTIFACT_NAMES
from surfacesignal.providers.sources import SOURCES
from surfacesignal.storage import read_json, safe_id


def load_areas(settings):
    result = []
    for path in sorted(settings.areas_dir.glob("*.geojson")):
        feature = read_json(path)
        result.append(AreaConfig(**feature["properties"], geometry=feature["geometry"]))
    return result


def load_scenes(settings):
    return [
        s
        for path in sorted(settings.catalog_dir.glob("*.json"))
        for s in CatalogSnapshot.model_validate(read_json(path)).scenes
    ]


def create_app(settings=None):
    settings = settings or Settings()
    app = FastAPI(
        title="SurfaceSignal exploratory backend",
        version="0.1.1",
        description="Exploratory experiment. Changes are not validated inundation or operational alerts.",
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

    for exception in (OSError, json.JSONDecodeError, ValidationError):
        app.add_exception_handler(exception, corrupt_store)

    def page(items, offset, limit):
        return {
            "items": items[offset : offset + limit],
            "total": len(items),
            "offset": offset,
            "limit": limit,
        }

    def get_analysis(identifier):
        try:
            safe_id(identifier)
        except ValueError:
            raise HTTPException(404, "Analysis not found") from None
        folder = settings.artifacts_dir / identifier
        if (
            not (folder / "manifest.json").is_file()
            or folder.resolve().parent != settings.artifacts_dir.resolve()
        ):
            raise HTTPException(404, "Analysis not found")
        return Analysis.model_validate(read_json(folder / "manifest.json"))

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "surfacesignal", "operational_alerts": False}

    @app.get("/api/v1/areas", response_model=Page[AreaConfig])
    def areas(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        return page(load_areas(settings), offset, limit)

    @app.get("/api/v1/areas/{area_id}", response_model=AreaConfig)
    def area(area_id: str):
        for item in load_areas(settings):
            if item.area_id == area_id:
                return item
        raise HTTPException(404, "Area not found")

    def scene_availability(item):
        path = settings.root / "data" / "raw" / (item.scene_id + ".h5")
        available = (
            path.resolve().parent == (settings.root / "data" / "raw").resolve()
            and path.is_file()
            and item.size_bytes is not None
            and path.stat().st_size == item.size_bytes
        )
        return SceneAvailability(**item.model_dump(), local_available=available)

    @app.get("/api/v1/scenes", response_model=Page[SceneAvailability])
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

    @app.get("/api/v1/scenes/{scene_id}", response_model=SceneAvailability)
    def scene(scene_id: str):
        for item in load_scenes(settings):
            if item.scene_id == scene_id:
                return scene_availability(item)
        raise HTTPException(404, "Scene not found")

    @app.get("/api/v1/analyses", response_model=Page[Analysis])
    def analyses(
        area_id: str | None = None,
        offset: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
    ):
        if area_id:
            area(area_id)
        items = [
            get_analysis(p.parent.name)
            for p in sorted(settings.artifacts_dir.glob("*/manifest.json"))
            if not p.parent.name.startswith(".")
        ]
        return page([a for a in items if not area_id or a.area_id == area_id], offset, limit)

    @app.get("/api/v1/analyses/{analysis_id}", response_model=Analysis)
    def analysis(analysis_id: str):
        return get_analysis(analysis_id)

    @app.get("/api/v1/analyses/{analysis_id}/evidence", response_model=Evidence)
    def evidence(analysis_id: str):
        return get_analysis(analysis_id).evidence

    @app.get("/api/v1/analyses/{analysis_id}/artifacts", response_model=dict[str, str])
    def artifacts(analysis_id: str):
        item = get_analysis(analysis_id)
        return {
            name: f"/api/v1/analyses/{analysis_id}/artifacts/{name}"
            for name in sorted(set(item.artifacts) | {"manifest.json"})
            if name in ARTIFACT_NAMES
        }

    @app.get("/api/v1/analyses/{analysis_id}/artifacts/{name}")
    def artifact(analysis_id: str, name: str):
        item = get_analysis(analysis_id)
        if name not in ARTIFACT_NAMES or (name != "manifest.json" and name not in item.artifacts):
            raise HTTPException(404, "Artifact not found")
        folder = (settings.artifacts_dir / analysis_id).resolve()
        path = (folder / name).resolve()
        if path.parent != folder or not path.is_file():
            raise HTTPException(404, "Artifact not found")
        return FileResponse(path, filename=name)

    @app.get("/api/v1/sources", response_model=Page[DataSource])
    def sources(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        return page(SOURCES, offset, limit)

    return app


app = create_app()
