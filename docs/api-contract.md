# API contract

Base: http://127.0.0.1:8000; interactive /docs; generated authoritative /openapi.json.

The API is **optional**. On a fresh clone without original SAR artifacts it reads the checked-in public compact snapshot. The static website accesses the same prepared data directly without calling FastAPI. See [backend operations](backend-operations.md) and [snapshot delivery](snapshot-delivery.md).
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

## Prepared analysis and interpretation endpoints

The original Analysis/Page fields remain unchanged. Detail adds `derived` (nullable manifest)
and `links`; historical manifest files are unchanged. API title is SurfaceSignal API.
New GET routes: `/api/v1/areas/{area_id}/overview`, `/timeline`;
`/api/v1/analyses/{analysis_id}/statistics`, `/layers`, `/story?lang=pt|en`;
`/api/v1/layers`, `/capabilities`, `/methodology`, `/stories?lang=pt|en`.
Capabilities is a paginated Page; layers is `{analysis_id, items}`. Other new responses are
typed objects described in `/openapi.json`. UTC times, km² area, dB differences and null
unavailable results are preserved. All scientific outputs remain `not_validated`.

Analysis listing adds `exclude_synthetic` and `sort_by=date|changed_area|magnitude|components|acquisition`.
Numeric ordering is descending with unavailable last; date ascending; ties use analysis ID.
These are exploration orders, never risk/severity rankings. Overview/timeline support language
and synthetic exclusion. Comparisons can contain multiple analysis IDs for parameter variants.
Groups retain every comparability field. Per-analysis valid coverage differs from AOI geometry.

Example request: `GET /api/v1/analyses/{id}/statistics` returns capability objects with
`status`, `method`, `units`, `parameters`, `statistics`, `derived_id`, `validation_status`.
An unavailable general capability has `status="unavailable"`, `statistics=null`, `parameters=null`.
A story includes `observation`, `result`, `interpretation`, `water_interpretation`, limitations,
metrics and sources. Synthetic examples are labelled in both `summary` and `data_status`.
See [interpretation states](interpretation-model.md) and [static route mapping](static-publication.md).

Empty overview states: `no_observations`, `no_compatible_pairs`, `not_processed`,
`partially_available`, `available`. Corrupt prepared stores return sanitized 503; unknown
resources/artifacts 404; invalid language/date/order/pagination 422; unsupported writes 405.
CORS preflight from disallowed origins/methods returns 400. `/health` checks the service only.

## Local analysis and preparation extension — 2026-11-15

Additive GET routes: `/api/v1/areas/{area_id}/local-analysis?lang=pt|en` and
`/api/v1/areas/{area_id}/preparation?audience=residents|municipal&lang=pt|en`.
Defaults are `pt`/`residents`; responses use `LocalReport`/`PreparationPlan` schemas
in OpenAPI. They read a verified offline `preparation build`; no generation or
network/raster access occurs in HTTP. Known but unprepared areas return 404 with
`error.code=preparation_not_prepared`; unknown areas return ordinary 404; corrupt
or stale builds return sanitized 503; invalid language/audience returns 422.
Plans are proposed, require human review, and do not confirm environmental impact.
Optional context is explicitly unavailable when absent. See
[local analysis and preparation](local-analysis-preparation.md).

## Environmental context extension — 2026-11-15

Additive GET routes: `/analyses/{id}/environmental-context`, `/analyses/{id}/validation`,
`/areas/{id}/environmental-events`, `/areas/{id}/reference-layers`, and `/context/sources`
under `/api/v1`. Models are in OpenAPI. Events support inclusive UTC `start`/`end`
calendar dates and offset/limit pagination. Context reads are local only: unprepared
404 (`context_not_prepared`), corrupt stores 503, invalid filters 422. Nulls and
per-record synthetic status are preserved. See [integration](environmental-data-integration.md).
