# API contract

Base: http://127.0.0.1:8000; interactive /docs; generated authoritative /openapi.json.
All endpoints are GET and do no remote requests. List envelope: items, total, offset, limit.
Limit 1..200; offset >=0. Dates are inclusive UTC calendar dates; start must not exceed end.

| Route | Response |
|---|---|
| /health | status, service, operational_alerts=false |
| /api/v1/areas | Page[AreaConfig] |
| /api/v1/areas/{area_id} | AOI geometry and provenance |
| /api/v1/scenes?area_id=&start=&end= | Page[Scene] |
| /api/v1/scenes/{scene_id} | Scene with original catalog metadata |
| /api/v1/analyses?area_id= | Page[Analysis] |
| /api/v1/analyses/{analysis_id} | validated manifest |
| /api/v1/analyses/{analysis_id}/evidence | deterministic evidence |
| /api/v1/analyses/{analysis_id}/artifacts | artifact name → relative GET URL |
| /api/v1/analyses/{analysis_id}/artifacts/{name} | whitelisted local file |
| /api/v1/sources | Page[DataSource] |

Missing resource 404; invalid query 422; unreadable/corrupt prepared store 503.
Error envelope: `{"error":{"code":"...","message":"..."}}`.
No credentials are accepted by the API. It does not emit 503 because NASA is offline:
NASA is only contacted by the CLI, which returns exit 3 for a sanitized provider failure.
CLI input errors use exit 2. Unmeasured values are null, not zeros. Empty catalog is an
empty list, not simulated observations. Public deployment still needs service authentication.

Scene responses additionally compute `local_available` from safe local file presence and
known catalog byte size. This is not a fresh checksum or scientific quality verification.
