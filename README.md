# SurfaceSignal — Sudo Nova

**NASA Space Apps project — 2026-11-14. Not an operational alert system.**
Do not merge into a competition submission without explicit eligibility clearance.
See [prototype provenance](docs/prototype-provenance.md).

SurfaceSignal investigates changes in NASA/ISRO NISAR L2 GCOV radar backscatter around
Lajeado/Estrela, Brazil. It catalogs comparable acquisitions, crops HDF5 on a bounded AOI,
compares gamma0 power in dB, exports candidate polygons and explains evidence and limits.
A candidate is **not a confirmed flood**. There is no frontend, chatbot or HTTP processing queue.

## What is verified

- Real ASF discovery: **19 PROVISIONAL GCOV scenes**, 2026-06-17 through 2026-10-31,
  queried with the configured 5 km pilot AOI. Snapshot and query are in
  [docs/evidence/asf-catalog.json](docs/evidence/asf-catalog.json).
- Mathematical/geospatial processing, deterministic exports and offline API are tested with
  explicitly synthetic HDF5. No actual GCOV measurement has been processed in this execution.
- HDF5 access blocked: July 23 product HEAD returned **403**; this environment has neither
  Earthdata token nor .netrc. No bulk download was attempted. See [execution evidence](docs/real-data-execution.md).
- SGB July 23, 16:00 Brasília bulletin is integrated as qualitative context. Numeric river
  levels remain null because the reviewed article does not supply station readings.
- GitHub `main` and `develop` rulesets: **BLOCKED_BY_PLAN** (403); JSON files are templates only.

## Run locally (Python 3.12)

Run the following from the repository root. Copy `.env.example` to the root `.env` if
you are connecting a frontend. You can skip the copy for API-only development.

```sh
cd backend
uv sync --frozen --extra dev
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
# Optional: import the real metadata snapshot to demonstrate the API offline.
uv run surfacesignal scenes import --file ../docs/evidence/asf-catalog.json
uv run uvicorn surfacesignal.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
curl -f http://127.0.0.1:8000/health
curl -f http://127.0.0.1:8000/api/v1/areas
curl -f 'http://127.0.0.1:8000/api/v1/scenes?area_id=vale-do-taquari&limit=10'
curl -f http://127.0.0.1:8000/api/v1/sources
curl -f http://127.0.0.1:8000/openapi.json
sh scripts/smoke-test.sh
```

Interactive contract: http://127.0.0.1:8000/docs. API reads local files only.
`analyses` starts empty until you process inputs. It never substitutes synthetic observations.
`SURFACESIGNAL_ROOT` can select another absolute repository/data root.

## Official local Docker execution

From repository root:

```sh
mkdir -p data artifacts
docker compose up --build
```

The non-root API container mounts data/artifacts/config read-only. Credentials are not mounted.
Heavy processing remains an explicit local CLI operation. Docker must be installed locally.
Compose reads `SURFACESIGNAL_CORS_ORIGINS` from the root `.env`. The container uses `/app` for its
data root. When running Python directly, the root `.env` is loaded even from `backend/`.
A `.env` in the current directory can override root settings, and exported variables take priority.

## Connect a frontend

Develop the web app under [`frontend/`](frontend/README.md). Use the root `.env` to allow the
frontend's exact origin and point the frontend at `http://127.0.0.1:8000`.
See the [API contract](docs/api-contract.md) for endpoints and response shapes.

## Search, download, inspect, compare

From `backend`:

```sh
uv run surfacesignal scenes search --area vale-do-taquari --start 2026-06-17 --end 2026-10-31
uv run surfacesignal scenes shortlist --area vale-do-taquari --event 2026-07-23
```

Use the complete IDs from the shortlist (shell variables below are literal identifiers):

```sh
BEFORE=NISAR_L2_PR_GCOV_025_053_D_103_4005_DHDH_A_20260711T213351_20260711T213426_P05023_N_F_J_001
AFTER=NISAR_L2_PR_GCOV_026_053_D_103_4005_DHDH_A_20260723T213350_20260723T213425_P05023_N_F_J_001
uv run surfacesignal scenes inspect --scene-id "$BEFORE"
# Configure official Earthdata .netrc (0600) or export EARTHDATA_TOKEN locally first.
# max-gb is a per-file decimal GB ceiling, not an expected file size.
uv run surfacesignal scenes download --scene-id "$BEFORE" --max-gb 12
uv run surfacesignal scenes download --scene-id "$AFTER" --max-gb 12
uv run surfacesignal gcov inspect --file "../data/raw/$BEFORE.h5" --output ../data/processed/before-inspection.json
uv run surfacesignal gcov crop --file "../data/raw/$BEFORE.h5" --area vale-do-taquari --output ../data/processed/before-power.tif
uv run surfacesignal analyze --area vale-do-taquari --before "$BEFORE" --after "$AFTER" --channel HHHH --frequency A --hydro-csv ../config/hydrology/sgb-2026-07-23.csv
```

Output: `artifacts/<content-derived-id>/` with PNG previews, `delta-db.tif`, candidate
GeoJSON, statistics, evidence and manifest. Inspect and tune thresholds for each channel;
HHHH defaults are not calibrated for HVHV. Thresholds do not estimate confidence.
To process a control pair, repeat with compatible catalog IDs and dates.

## Structure

```text
backend/src/surfacesignal/
  domain.py, config.py, storage.py, main.py, cli.py
  providers/   ASF discovery/download, hydrology CSV, source inventory
  processing/  bounded GCOV reader, temporal comparison, evidence/artifact export
backend/tests/ synthetic mathematical, geospatial, provider, CLI and API tests
frontend/      frontend integration guide and public configuration example
config/        documented pilot AOI and sourced hydrology context
.github/       CI, draft PR template, unapplied ruleset templates
docs/          method, provenance, reproducibility, limitations and submission gates
```

Add a region by placing a Feature GeoJSON in `config/areas/` with the same properties schema
as the pilot; supply a valid EPSG:4326 polygon, source URL, unique `area_id`, name and pixel budget.
No algorithm edits are needed. The pilot is an analyst-defined 5 km buffer, **not an IBGE
boundary or flood extent**; IBGE retrieval failed with 503 and that limitation is recorded.

## Documentation and attribution

[Method](docs/scientific-method.md) · [Validation](docs/validation.md) ·
[Reproduction](docs/reproducibility.md) · [Sources and terms](docs/data-sources.md) ·
[API](docs/api-contract.md) · [Limitations](docs/limitations.md) ·
[Repository controls](docs/repository-setup.md) · [Submission checklist](docs/submission-checklist.md)

Code licensing remains **pending owner authorization**; no open-source license is granted
by this project. Repository visibility remains private. Dataset and dependency terms are
independent of the code license. No merge or public release is performed.

Implementation verification: **41 offline tests passed, 90% statement coverage**, Ruff lint/format
clean. See [review fixes and acceptance status](docs/implementation-status.md) and
[GitHub Actions](https://github.com/matbforge/nsac26-dancing-with-the-sars/actions/workflows/backend-ci.yml).
