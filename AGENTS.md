# SurfaceSignal contributor instructions

The project currently has a published static frontend, 19 real NISAR acquisitions, 17 prepared comparisons and an optional local read-only FastAPI. See [README](README.md) and [docs index](docs/README.md), for current setup and integration behavior.

- Keep work on feature branches; target `develop` through review. Preserve `main` and historical commits.
- Preserve source provenance, original authorship and actual Git history. Do not claim competition compliance without authoritative evidence.
- NISAR GCOV products are provisional. Use compatible acquisitions, masks/looks, bounded memory, real diagonal gamma0 power only, `10 log10(power)`, explicit uncalibrated thresholds, deterministic output provenance and SHA256.
- Never label unvalidated radar-change components as confirmed floods, landslides, ground motion, damage, risk or emergency alerts.
- Distinguish actual CHIRPS v3 / JRC / WorldCover / Copernicus / IBGE / SGB inputs from optional unaquired sources. Unavailable measurements remain `null`.
- Never commit Earthdata credentials, `.env`, `.netrc`, local raw HDF5 or restricted native datasets.
- `frontend/src/data/source.ts` is the only browser data adapter; it selects the committed compact snapshot or optional API.
- Compact polygons are **visualization-only**. Do not derive new scientific measurements from them.
- Original code/docs are Apache-2.0; other scientific datasets and third-party assets preserve separate terms.
- Next.js 16 may differ from previous framework APIs: consult installed Next documentation before changing Next-specific features.

Checks: `cd frontend && npm ci && npm test && npm run lint && npm run build && npm run check:static`.
Backend: `cd backend && uv sync --frozen --extra dev && uv run ruff check . && uv run ruff format --check . && uv run pytest -q`.

For frontend-specific UX constraints, see [frontend/AGENTS.md](frontend/AGENTS.md).
