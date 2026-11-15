"""Read-only API for cloned/installed public snapshots without scientific inputs."""

from datetime import UTC, date, datetime, time

from fastapi.responses import FileResponse, JSONResponse

from surfacesignal.preparation.context import safe_path
from surfacesignal.storage import checksum, read_json


def _error(status, code):
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": "Published resource unavailable"}},
    )


def snapshot_root(settings):
    if any(settings.artifacts_dir.glob("*/manifest.json")):
        return None
    for name in ("api/v1", "compact/api/v1"):
        base = settings.root / "frontend/public/data" / name
        if (base / "publication-report.json").exists():
            return base
    return None


def _integer(query, key, default, low, high):
    value = int(query.get(key, default))
    if not low <= value <= high:
        raise ValueError("Invalid pagination")
    return value


def _filename(path, query):
    relative = path.removeprefix("/api/v1/")
    if relative == "context/sources":
        return "context-sources.json"
    if "/artifacts/" in relative or "/references/" in relative:
        return relative
    lang = query.get("lang", "pt")
    if lang not in {"pt", "en"}:
        raise ValueError("Invalid language")
    last = relative.rsplit("/", 1)[-1]
    if last == "preparation":
        audience = query.get("audience", "residents")
        if audience not in {"residents", "municipal"}:
            raise ValueError("Invalid audience")
        relative += "." + audience
    if last in {"story", "stories", "overview", "timeline", "local-analysis", "preparation"}:
        relative += "." + lang
    return relative + ".json"


def _filter(payload, query, statistics=None):
    if not isinstance(payload, dict) or not {"items", "total", "offset", "limit"} <= set(payload):
        return payload
    offset = _integer(query, "offset", 0, 0, 2**31 - 1)
    limit = _integer(query, "limit", 50, 1, 200)
    start = date.fromisoformat(query["start"]) if "start" in query else None
    end = date.fromisoformat(query["end"]) if "end" in query else None
    if start and end and start > end:
        raise ValueError("Invalid UTC dates")
    selected = []
    for item in payload["items"]:
        if query.get("area_id") and item.get("area_id") != query["area_id"]:
            continue
        if query.get("exclude_synthetic") == "true" and item.get("synthetic"):
            continue
        stamp = item.get("observed_at", item.get("start_time"))
        if stamp and (start or end):
            instant = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if (start and instant < datetime.combine(start, time.min, UTC)) or (
                end and instant > datetime.combine(end, time.max, UTC)
            ):
                continue
        selected.append(item)
    order = query.get("sort_by", "date")
    if order not in {"date", "changed_area", "magnitude", "components", "acquisition"}:
        raise ValueError("Invalid ordering")
    if selected and "analysis_id" in selected[0]:
        from surfacesignal.processing.history import GROUP_FIELDS

        def ordering(item):
            scenes = item.get("scenes", [])
            after = scenes[-1].get("start_time", "") if scenes else ""
            identifier = item["analysis_id"]
            if order == "date":
                return (after, identifier)
            if order == "acquisition":
                group = str(tuple(scenes[0].get(field) for field in GROUP_FIELDS)) if scenes else ""
                return (group, after, identifier)
            stats = (statistics or {}).get(identifier) or {}
            value = {
                "changed_area": stats.get("changed_area_km2"),
                "magnitude": max(
                    abs(stats.get("min_delta_db") or 0), abs(stats.get("max_delta_db") or 0)
                )
                if stats
                else None,
                "components": stats.get("increase_components", 0)
                + stats.get("decrease_components", 0)
                if stats
                else None,
            }[order]
            return (value is None, -(value or 0), identifier)

        selected.sort(key=ordering)
    return {
        **payload,
        "items": selected[offset : offset + limit],
        "total": len(selected),
        "offset": offset,
        "limit": limit,
    }


def _api_urls(value):
    if isinstance(value, dict):
        return {key: _api_urls(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_api_urls(item) for item in value]
    if not isinstance(value, str):
        return value
    prefix = next(
        (p for p in ("/data/compact/api/v1/", "/data/api/v1/") if value.startswith(p)), None
    )
    if prefix is None:
        return value
    name = value[len(prefix) :]
    if "/artifacts/" in name or "/references/" in name:
        return "/api/v1/" + name
    name = name.removesuffix(".json")
    if name == "context-sources":
        name = "context/sources"
    query = []
    if name.endswith((".pt", ".en")):
        name, lang = name.rsplit(".", 1)
        query.append("lang=" + lang)
    if name.endswith(("preparation.residents", "preparation.municipal")):
        name, audience = name.rsplit(".", 1)
        query.append("audience=" + audience)
    return "/api/v1/" + name + ("?" + "&".join(query) if query else "")


def install_published_reader(app, settings):
    @app.middleware("http")
    async def read_published(request, call_next):
        if request.method != "GET" or not request.url.path.startswith("/api/v1/"):
            return await call_next(request)
        base = snapshot_root(settings)
        if base is None:
            return await call_next(request)
        try:
            name = _filename(request.url.path, request.query_params)
        except ValueError:
            return _error(422, "invalid_request")
        try:
            path = safe_path(base / name)
            if not path.resolve().is_relative_to(base.resolve()):
                return _error(404, "404")
            report_path = safe_path(base / "publication-report.json")
            if report_path.stat().st_size > 4_000_000:
                return _error(503, "store_unavailable")
            expected = read_json(report_path)["files"].get(name)
            if expected is None:
                code = (
                    "context_not_prepared"
                    if name.endswith(("environmental-context.json", "validation.json"))
                    else "404"
                )
                return _error(404, code)
            if path.stat().st_size > 25 * 1024 * 1024 or checksum(path) != expected:
                return _error(503, "store_unavailable")
            if path.suffix in {".geojson", ".png"}:
                return FileResponse(path, headers={"ETag": f'"{expected}"'})
            payload = read_json(path)
            statistics = {}
            if name == "analyses.json" and request.query_params.get("sort_by") in {
                "changed_area",
                "magnitude",
                "components",
            }:
                for item in payload["items"]:
                    identifier = item["analysis_id"]
                    statname = f"analyses/{identifier}/statistics.json"
                    statpath = safe_path(base / statname)
                    if (
                        not statpath.resolve().is_relative_to(base.resolve())
                        or statpath.stat().st_size > 25 * 1024 * 1024
                        or checksum(statpath) != read_json(report_path)["files"].get(statname)
                    ):
                        return _error(503, "store_unavailable")
                    statistics[identifier] = (read_json(statpath).get("general_change") or {}).get(
                        "statistics"
                    )
        except (OSError, ValueError, KeyError, TypeError):
            return _error(503, "store_unavailable")
        try:
            return JSONResponse(_api_urls(_filter(payload, request.query_params, statistics)))
        except (ValueError, TypeError):
            return _error(422, "invalid_request")
        except KeyError:
            return _error(503, "store_unavailable")
