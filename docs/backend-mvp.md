# Backend MVP delivery — 2026-11-15

SurfaceSignal — Making Earth's changes understandable.

Implemented on `feature/backend-surface-intelligence-mvp`, based on `develop` commit
`64b8d671679de8a847583a893e0fcd5bd86db306`. No push, merge, visibility or licence change.
The pre-existing untracked `plano-surfacesignal-nisar.md` was preserved.

## Implementation

New modules:

- `processing/general_change.py`: bounded derived SAR changes, metric areas, georeferenced
  polygons, distribution statistics, content-derived identities and integrity checks.
- `processing/capabilities.py`: general observations, increases/decreases, experimental water;
  vegetation/agriculture, soil moisture and urban explanations; ground motion unavailable.
- `interpretation/{models,content,engine}.py`: deterministic PT/EN stories and scientific method.
- `api/{schemas,service,routes,examples}.py`: prepared-data repository, typed aggregation,
  nine new endpoint patterns, validated illustrative Swagger examples.
- `publication.py`: bounded, verified, repeatable static export with backup and URL validation.
- Four new test files: general changes, interpretation, MVP API, publication.

Updated CLI, app factory, package/lock version 0.2.0 and the existing documentation.
Historical water algorithm, GCOV reader and original manifests remain unchanged. Analysis
list fields remain compatible; details add `derived` and `links`. Frontend visual components
and its existing API/static adapter remain unchanged. New general layers/narratives are ready
for frontend integration; this delivery does not claim they are already rendered by its controls.

New GET routes (prefix `/api/v1`):
`/areas/{id}/overview`, `/areas/{id}/timeline`, `/analyses/{id}/statistics`,
`/analyses/{id}/layers`, `/analyses/{id}/story`, `/layers`, `/capabilities`,
`/methodology`, `/stories`. Language is `pt|en`. Existing routes remain available.
Analysis list supports pagination, area/synthetic filters and date, changed area, magnitude,
component count or acquisition ordering. These are not risk rankings.

## Real local delivery

- Original HDF5 inventory: **19 files, 131,386,572,800 bytes**; size/mtime inventory unchanged.
- Original history verification: **verified=true, completed=true, scene_count=19,
  pair_count=17, errors=[]**. Full offline verifier was actually executed.
- **17/17** analyses enriched from existing delta TIFFs, no raw reprocessing/download.
- Each derivation has three GeoJSON files, statistics, evidence, manifest and current pointer.
- Snapshot: **19 real scenes, 17 real analyses, 222 files, 147,418,700 bytes** including report.
  No synthetic analysis, raw HDF5, credentials or TIFF is included. Previews were not requested.
- Static HTTP verification: 17 records, **68 GeoJSONs** (water plus three general layers per pair),
  **34 PT/EN stories** successfully read from a plain file server.
- Publication ID: `151ef6f704e959615eac9e54`. Identical repeated export verified successfully.
- Package: `data/publications/surfacesignal-vale-do-taquari-151ef6f704e959615eac9e54.tar.gz`,
  **19,890,427 bytes**, SHA256
  `4841aac4a7ea2eecc15279b97c5cf1dcee853c927e776c133ec6f77e8832067a`.
  All 221 report-listed payload hashes were independently checked inside the archive.

The package, complete static snapshot, derivations, raw files and original processed artifacts
remain local and Git-ignored. The prior main synthetic snapshot is preserved in the tracked
`frontend/public/data/demo/api/v1/`, with its historical labels. Full vectors are delivered
externally to avoid adding 147 MB of generated data to the repository. No external upload was
performed. A fresh clone needs the package installed or an API endpoint configured.

## Verification

- `uv sync --project backend --frozen --extra dev`: passed.
- `uv run --project backend --frozen ruff check backend`: passed.
- `uv run --project backend --frozen ruff format --check backend`: passed.
- `uv run --project backend --frozen pytest backend -q`: **116 passed**.
- One dependency warning: Starlette warns that its current httpx TestClient integration is
  deprecated. This is a warning, not a test failure; the lockfile's dependency versions are retained.
- Real loopback FastAPI: health, docs, OpenAPI, overview, timeline, capabilities, methodology
  and English stories returned 200. Observed regional metadata requests were below 0.2 seconds
  on this machine; this is a smoke observation, not a performance guarantee.
- Frontend `npm run lint` and `npm run build` passed after `npm ci` restored the lockfile dependencies.
  Initial build failed because local MapLibre worker files were missing; reinstall resolved it without
  source changes. `npm audit` reports seven moderate development-tool dependency findings
  (typescript-eslint/minimatch chain), zero high/critical; no automatic dependency upgrades were made.
- Original `history verify` passed; pytest/CI use small synthetic data, never the real history.
- Code review defects were fixed with regressions: stale source/derived mixing, incompatible
  stored scene pairs, publication inventory tampering and extra files. Path/symlink, budget,
  corruption, missing-data, language, CORS and exact static-contract checks are covered.

## Operation and handoff

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend --frozen uvicorn surfacesignal.main:app --host 127.0.0.1 --port 8000
# Swagger http://127.0.0.1:8000/docs
uv run --project backend --frozen surfacesignal --root "$PWD" derive build --area vale-do-taquari
uv run --project backend --frozen surfacesignal --root "$PWD" publish build \
  --area vale-do-taquari --output frontend/public/data/api/v1 \
  --validate --exclude-synthetic --max-export-bytes 250000000
```

On another machine, obtain the verified package from the owner, compare SHA256, then extract
its `api/v1` directory into `frontend/public/data/` before building Next.js:

```sh
mkdir -p frontend/public/data
tar -xzf /path/to/surfacesignal-vale-do-taquari-151ef6f704e959615eac9e54.tar.gz -C frontend/public/data
```

Do not overwrite another installed snapshot without retaining it. Leave `NEXT_PUBLIC_API_BASE_URL`
unset for static mode. For API mode set it to the backend origin and configure backend
`SURFACESIGNAL_CORS_ORIGINS` for the exact frontend origin (development: `http://localhost:3000`).
See [deployment](backend-deployment.md), [publication](static-publication.md),
[general method](general-change-analysis.md) and [interpretation](interpretation-model.md).

## Limits

Integrity and completed computation are not independent scientific validation. General change
identifies radar intensity changes; water remains experimental possible open-water change.
No confirmed damage, flood, deforestation, soil moisture retrieval, ground displacement,
predictive models or alerts are claimed. No overlapping temporal areas are summed. Ascending
and descending comparisons remain in separate acquisition groups. Publication writers are serial;
metadata scanning is appropriate for this modest filesystem catalog, not a distributed service.

The local branch is prepared for a **Draft PR to develop**. Owner approval is required before
any push. GO Team clearance remains required before competition integration.
