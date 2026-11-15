<div align="center">

<p><a href="https://sudonova.surfacesignal.earth"><img src="assets/sudo-nova-logo.png" alt="Sudo Nova" width="150" align="middle" /></a>&nbsp;&nbsp;&nbsp;<a href="https://surfacesignal.earth"><img src="assets/surface-signal-logo.png" alt="SurfaceSignal" width="210" align="middle" /></a></p>

<h1>SurfaceSignal</h1>
<p><strong>Making Earth's Changes Understandable</strong></p>
<p>NASA Space Apps Challenge 2026 · Dancing with the SARs · Sudo Nova</p>
<p><strong>English</strong> · <a href="./README.pt-BR.md">Português</a></p>
<p><a href="https://surfacesignal.earth"><img src="https://img.shields.io/badge/LIVE_APPLICATION-00DBE7?style=for-the-badge&amp;labelColor=071824&amp;logo=cloudflare&amp;logoColor=white" alt="Explore application" /></a> <a href="https://github.com/sudo-nova-nsac26/presentation/blob/main/Surface%20Signal%20-%20Presentation.pdf"><img src="https://img.shields.io/badge/PRESENTATION_PDF-172A38?style=for-the-badge&amp;logo=adobeacrobatreader&amp;logoColor=white" alt="View presentation" /></a></p>
<p><a href="https://surfacesignal.earth">Website</a> · <a href="https://github.com/sudo-nova-nsac26/presentation/blob/main/Surface%20Signal%20-%20Presentation.pdf">Presentation</a> · <a href="https://sudonova.surfacesignal.earth">Team</a> · <a href="https://www.spaceappschallenge.org/2026/find-a-team/sudo-nova/?tab=project">NASA project</a></p>

</div>

---
## Explore the Earth through real radar observations

[SurfaceSignal](https://surfacesignal.earth) is Sudo Nova's bilingual, interactive environmental-change exploration platform. For the Taquari Valley in Brazil (Lajeado and Estrela), it processes **19 NASA–ISRO NISAR L2 GCOV acquisitions** (~**131.39 GB** original HDF5) into **17 historical radar comparisons**, contextualized with independent public environmental information.

The platform shows *candidate* surface changes. A radar threshold is **not** independent evidence of flooding, damage, hazard, or people affected. SurfaceSignal is not an emergency-warning or flood-forecasting system.

## Run it locally: two supported modes

**Both modes read already-prepared results, not raw HDF5.** No visitor needs Earthdata credentials or a Python data processor. They differ in how JSON and GeoJSON are served.

| | Static (default, recommended) | Read-only API (optional) |
|---|---|---|
| Purpose | Web development and public Cloudflare Pages deployment | API/contract work, external clients, locally prepared scientific outputs |
| Where data comes from | Committed `frontend/public/data/compact/api/v1/` | FastAPI `/api/v1/` (prepared local outputs or bundled snapshot) |
| Python, Docker, NASA login | **None** | Python 3.12 or Docker; Earthdata **not** needed for existing snapshot |
| Original 131 GB download | **No** | **No** — only needed for new scientific processing |

### Option A — website only (no API)

Requirements: **Node.js 24** (see `frontend/.node-version`) and npm.

```sh
git clone https://github.com/sudo-nova-nsac26/surface_signal.git
cd surface_signal/frontend
npm ci
npm run dev
```

Open **http://localhost:3000/**, then `/pt/` or `/en/`. Validate/export for Cloudflare Pages:

```sh
npm test
npm run lint
npm run build
npm run check:static
npm start
```

Static output: `frontend/out/`. The committed compact snapshot contains **all 19 scene records and 17 analyses** with original statistics and summarized geometry. **Reduced GeoJSON polygons are for display only**, not for recalculating scientific areas or counting all features. Background map tiles/terrain use external services, so a completely offline basemap is not bundled.

### Option B — frontend connected to the local FastAPI

Requirements: Python **3.12** and [uv](https://docs.astral.sh/uv/), or Docker. From the repository root:

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend --frozen uvicorn surfacesignal.main:app --host 127.0.0.1 --port 8000
```

Or start the read-only API container:

```sh
mkdir -p data artifacts
docker compose up --build
```

Verify: `curl http://127.0.0.1:8000/health`, `curl http://127.0.0.1:8000/api/v1/analyses`. Interactive OpenAPI: **http://127.0.0.1:8000/docs**.

In `frontend/`, copy `.env.example` to **`.env.local`**, uncomment:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Allow frontend origins in the root `.env` when needed:

```dotenv
SURFACESIGNAL_CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

Restart `npm run dev`. Remove the frontend API variable to switch back to static mode. **Never deploy the public site with a localhost API URL:** `NEXT_PUBLIC_*` settings are bundled into browser code. No credential belongs in those variables.

The FastAPI server reads prepared data only; it does not contact NASA on HTTP requests. If no original scientific manifests exist, its published reader serves the compact bundled snapshot (the Docker Compose configuration mounts it read-only). Original local artifacts take precedence when present. For advanced processing and source imports, see [backend operations](docs/backend-operations.md).

## Sources used in the actual pilot

| Data product | Processing/use | Critical limit |
|---|---|---|
| **NASA–ISRO NISAR L2 GCOV / ASF** | 19 scenes, 17 comparable temporal analyses: masked gamma0 power, dB differences, component candidates | Provisional radar change, not confirmed inundation |
| **CHIRPS v3 final SAT** | 57 native daily AOI crops; rainfall summaries by complete UTC date labels | Estimated precipitation, not station measurements or exact SAR-hour totals |
| **JRC Global Surface Water v1.5** | Historical occurrence, 1984–2024 | Not contemporary 2026 flood extent |
| **ESA WorldCover 2021 v200** | Land-cover classes (10 m) | Not a 2026 land-cover change map |
| **Copernicus DEM GLO-30** | Surface elevation and derived slope | DSM includes buildings/vegetation; not ground motion |
| **IBGE** | Official **2022** municipality geometries and names | Geographic context, not affected-population statistics |
| **SGB/SACE Taquari** | Qualitative, dated river-basin bulletins | No invented numeric readings or independent spatial validation |

NASA GPM **IMERG was not separately ingested**; neither were ANA live readings, MapBiomas, independent Sentinel/OPERA imagery, RCM or Open-Meteo. CHIRPS v3 SAT uses IMERG Late in its production lineage; this is **not equivalent to ingesting IMERG**.

The radar method uses comparable scenes and masks, converts **real diagonal GCOV gamma0 power** with `10 log10(power)`, aligns imagery, computes `ΔdB = after − before`, and identifies exploratory candidate polygons with configurable thresholds and minimum connected-component sizes. Generic signal increases/decreases are mapped separately, **without asserting environmental causes**. Scientific integrity/reproducibility is documented, but independent field/pixelwise validation **has not been completed**.

Read [sources and license conditions](docs/data-sources.md), [scientific method](docs/scientific-method.md), [environmental acquisition evidence](docs/public-source-evidence.md), [real NISAR processing](docs/real-data-execution.md), [validation](docs/validation.md) and [limitations](docs/limitations.md).

## Scientific processing (advanced; not required to run the site)

For a **new** HDF5 download/process, install Python 3.12 and uv, reserve sufficient disk space (~180 GB for the historical batch), and configure your own **authorized** NASA Earthdata/ASF access. Preview the work without downloading:

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend --frozen surfacesignal --root "$PWD" history run \
  --snapshot docs/evidence/asf-catalog.json \
  --hydro-csv config/hydrology/sgb-2026-07-23.csv --dry-run
```

For actual acquisition use a local `~/.netrc` (permissions `0600`) or `SURFACESIGNAL_EARTHDATA_TOKEN` (legacy `EARTHDATA_TOKEN` is supported); run without `--dry-run`. Never commit credentials or HDF5. The existing published snapshot eliminates this requirement for frontend contributors. See [operations](docs/backend-operations.md), [snapshot distribution](docs/snapshot-delivery.md) and [reproducibility](docs/reproducibility.md).

## Architecture and documentation

```text
frontend/              Next.js 16, React, MapLibre, accessible PT/EN UI
  src/data/source.ts   single static/API adapter
  public/data/compact  committed results (visualization-only polygons)
backend/               Python 3.12, read-only FastAPI, CLI and SAR processing
config/                pilot AOI, context source examples
docs/                  methodology, provenance, deployments, operations
assets/                Sudo Nova and SurfaceSignal project logos
```

[Documentation index](docs/README.md) · [API contract](docs/api-contract.md) · [Cloudflare Pages](docs/cloudflare-pages.md) · [Security](SECURITY.md).

## Team, license and credits

**Arthur Henrique Fassina**, **Mateus Carniel Brambilla** and **Yuri Korolko** · [Team portfolio](https://sudonova.surfacesignal.earth) · [Project presentation](https://github.com/sudo-nova-nsac26/presentation/blob/main/Surface%20Signal%20-%20Presentation.pdf) · [NASA Space Apps entry](https://www.spaceappschallenge.org/2026/find-a-team/sudo-nova/?tab=project).

Original SurfaceSignal code and original project documentation: **[Apache License 2.0](LICENSE)** (SPDX `Apache-2.0`). Third-party scientific data, map layers, software, fonts and visual assets **retain their own usage terms**, and are **not relicensed** by the project's code license. See [NOTICE](NOTICE) and [source attribution](docs/data-sources.md). Earlier prototyping and unresolved competitive eligibility questions are recorded in [provenance](docs/prototype-provenance.md); a code license does **not** certify competition eligibility.

<div align="center"><sub>Independent Sudo Nova project · Brazil · 2026 · Not affiliated with NASA or ISRO.</sub></div>
