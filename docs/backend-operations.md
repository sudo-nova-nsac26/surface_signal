# Backend and scientific operations (optional)

The static [SurfaceSignal](https://surfacesignal.earth) web app is complete without a local API or HDF5 files.
Use the backend when you need **HTTP integration**, reproducible scientific processing, acquisition or new publication.

## Read-only FastAPI — with no HDF5 download

In the repository root, with Python **3.12** and [uv](https://docs.astral.sh/uv/):

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend --frozen uvicorn surfacesignal.main:app --host 127.0.0.1 --port 8000
```

Or Docker:

```sh
mkdir -p data artifacts
docker compose up --build
```

`docker-compose.yml` mounts `config/`, `data/`, `artifacts/` and the committed
`frontend/public/data/compact/` directory read-only. On a fresh clone
with no scientific manifests, `api/published.py` serves the compact public snapshot.
When real artifact manifests are present, the API uses the local prepared scientific stores.

Verify:

```sh
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/v1/areas
curl http://127.0.0.1:8000/api/v1/analyses
curl http://127.0.0.1:8000/openapi.json
```

Use `http://127.0.0.1:8000/docs` for interactive OpenAPI. Set `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` **in frontend/.env.local**, and `SURFACESIGNAL_CORS_ORIGINS` in root `.env`. CORS is not authentication. Do not expose this API publicly without a security review.

## Real SAR acquisition and processing

Requires authorized Earthdata access, Python 3.12, uv and adequate disk. The 19 provisional NISAR HDF5 files total **131,386,572,800 bytes**. An approximate **180 GB** of free space is suggested for the history run. This is **never** needed merely to view the public app.

Check the plan without downloading:

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend --frozen surfacesignal --root "$PWD" history run \
  --snapshot docs/evidence/asf-catalog.json \
  --hydro-csv config/hydrology/sgb-2026-07-23.csv --dry-run
```

Configure an authorized `~/.netrc` with `chmod 600 ~/.netrc` (or
`SURFACESIGNAL_EARTHDATA_TOKEN` in the local operator process), then
run the same command without `--dry-run`.

```sh
uv run --project backend --frozen surfacesignal --root "$PWD" history verify \
  --area vale-do-taquari
```

The history runner reuses verified raw scenes and already completed comparisons
when inputs/parameters/hashes match. It does not rewrite scientific artifacts
merely to refresh frontend presentation. Dates, query conditions and historical
errors remain documented in [real-data execution](real-data-execution.md).

## Public environmental input, context and snapshots

These are CLI developer commands, not HTTP routes:

```sh
uv run --project backend --frozen surfacesignal --root "$PWD" sources check
uv run --project backend --frozen surfacesignal --root "$PWD" sources fetch --area vale-do-taquari
uv run --project backend --frozen surfacesignal --root "$PWD" context build --area vale-do-taquari
uv run --project backend --frozen surfacesignal --root "$PWD" context verify --area vale-do-taquari
uv run --project backend --frozen surfacesignal --root "$PWD" publish compact --area vale-do-taquari
uv run --project backend --frozen surfacesignal --root "$PWD" publish full --area vale-do-taquari
```

The compact snapshot already committed to `frontend/public/data/compact/api/v1`
contains all 17 public comparisons. Full scientific vectors can be packaged
separately; a full release is not assumed to exist. Sources keep their original
attribution and license terms. Read [snapshot delivery](snapshot-delivery.md)
and [environmental acquisition evidence](public-source-evidence.md).

## Verification

```sh
cd frontend
npm ci
npm test
npm run lint
npm run build
npm run check:static

cd ../backend
uv sync --frozen --extra dev
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
```

To test Docker API health, start `docker compose up --build` then run
`sh scripts/smoke-test.sh` from the repository root.
Software-test success and SHA256 verification are **not** independent validation of flood candidates.
