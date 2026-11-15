# Environmental context — 2026-11-15

Implementation of the supplied environmental backend plan and frontend handoff.
Context is an additive, offline product. It never rewrites NISAR GCOV outputs,
reprocesses HDF5, or establishes a confirmed flood. API requests read prepared
JSON only; providers are never contacted by GET requests.

## Operations

From the repository root:

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend surfacesignal --root "$PWD" context sources list
uv run --project backend surfacesignal --root "$PWD" context import --help
uv run --project backend surfacesignal --root "$PWD" context build --help
uv run --project backend surfacesignal --root "$PWD" context verify --help
uv run --project backend surfacesignal --root "$PWD" publish build --help
```

Imports require a local source file and explicit metadata: provider, product/version,
retrieval and observation timestamps with timezone, citation URL, file SHA256, CRS,
units, resolution, license review, redistribution permission and synthetic status.
Never put a token or a signed download URL in citation metadata. A license on a
catalog web page does not establish permission to redistribute a particular product.
CLI writers must run serially. Import and build support dry runs and explicit budgets.
Small synthetic tests are fixtures, not public observations.

Prepared contexts live separately under `data/context/`. Each selected analysis
has immutable content-addressed outputs with a verified current pointer. Identity
includes input hashes, product metadata, AOI and processing parameters. Execution
time does not create a new identity. Corruption is an error, not an empty dataset.
Original `artifacts/`, raw NISAR data and historical preparation reports remain intact.

## Public contract

| GET path under `/api/v1` | Static path under `/data/api/v1` |
|---|---|
| `analyses/{id}/environmental-context` | `analyses/{id}/environmental-context.json` |
| `analyses/{id}/validation` | `analyses/{id}/validation.json` |
| `areas/{id}/environmental-events` | `areas/{id}/environmental-events.json` |
| `areas/{id}/reference-layers` | `areas/{id}/reference-layers.json` |
| `context/sources` | `context-sources.json` |

OpenAPI is authoritative. Availability states are `available`, `partial`,
`unavailable` and `not_checked`; unavailable measurements remain null. Source
registration is separate from actual use in a comparison. Missing preparation is
404; corrupt prepared content is 503. Events retain their type, station, UTC time,
quality and synthetic status. API lists paginate; static lists contain all selected
records and are filtered by UTC in the frontend adapter.

After building contexts, add `--include-environmental-context` to `publish build`.
It is compatible with `--include-preparation`. Use `--exclude-synthetic` for real
packages; contexts with synthetic inputs are excluded even if their SAR analysis
is real. Missing context files are omitted, preserving the expected static 404.
Unlicensed context and unsupported overlay URLs fail publication. Exports contain
bounded JSON summaries/reference metadata, not raw environmental rasters.
All exported context files participate in hashes, internal URL checks and the total
publication budget. Publication cannot replace `data/context`.

## Interpretation boundaries

- Hydrology preserves station identity, unit, datum, quality and acquisition offset.
  Missing measurements and rejected samples never become zero or basin-wide claims.
- IMERG integrates interval rates as rate × duration, clips at acquisition time and
  requires declared temporal coverage. Accumulated quantities are not summed as rates.
  Its regional spatial support must not be presented as SAR-pixel rainfall.
- MapBiomas is historical context with explicit collection, classes and reference year.
  WorldCover 2021 v200 is a static surface map, not vegetation monitoring in 2026.
- DSM elevation and slope describe a surface, not bare ground, flood level, safety,
  hazard or InSAR movement. Original slope availability controls remain unchanged.
- Municipal intersections describe geometry, not affected people or confirmed damage.
- Reference agreement requires independent, temporally comparable data and valid
  shared coverage. Without that evidence validation stays `not_validated`; no score
  is invented. OPERA shares SAR ambiguities. Sentinel/RCM discovery is not processing.

## Live-data prerequisites and review

No credentials are included or requested by HTTP. Access-controlled ANA, Earthdata,
GEE and EODMS products need an authorized operator to acquire and verify inputs.
No environmental source is marked integrated merely because its adapter exists.
Real input availability and individual terms must be checked before importing;
without them reports honestly state the gaps. Large source rasters and public
snapshot bundles are distributed outside Git.

The frontend reads context through `src/data/source.ts`, tied to the selected
analysis ID. It presents separate environmental evidence and reference dates in
PT/EN, preserves genuine zeros and unavailable values, and cancels obsolete requests.
V1 reference maps may be represented by statistics and metadata without pixel overlays.

## Import formats and reference qualification

Hydrological CSV/JSON rows use `station_id`, `station_name`, `observed_at` with
an explicit offset, `parameter` (`river_level`, `rainfall`, `discharge`), `value`
(nullable), `unit`, `quality_status` (`valid`, `provisional`, `rejected`, `missing`),
`method` and optional `datum`, `longitude`, `latitude`, `original_timezone`.
JSON wraps rows in `records`. Identical duplicates collapse; conflicts fail.
The legacy qualitative bulletin CSV remains a separate format and is not converted
into numerical readings. No automatic authenticated ANA collector is enabled.

IMERG accepts a documented regional interval series JSON (`records` with `start`,
`end`, `value`, `unit`, `quality_status`). Metadata requires `dataset_version` starting
with `07`, `parameters.run` and explicit `parameters.spatial_support`. A raster alone
does not define temporal coverage; convert/extract the documented product series
before importing. Interval totals crossing a window boundary are excluded instead
of assuming an intra-interval rainfall distribution. Import one consolidated file
per source; its new current pointer replaces the selected import, retaining history.

GeoTIFF imports require one band, CRS and explicit nodata. MapBiomas uses
`dataset_version="5"`, `reference_year`, `asset_id`, `band`, `product_kind` and
`water_classes` (annual/monthly) or `frequency_scale` (1 or 100). Monthly products
also require `reference_month`. WorldCover requires `reference_year=2021` and
`dataset_version="v200"`. DSM requires metre units and `vertical_datum`.
Extra product fields belong in metadata `parameters`. Pixel windows are bounded
before reading. AOI summaries and union-of-candidate summaries are recorded separately;
intersections use equal-area pixel footprints. No per-polygon damage inference.

For an audited EMS, OPERA or Sentinel-2 reference, import a local JSON with
`reference_geometry`, `valid_coverage` (EPSG:4326 polygons), `reference_at`,
`independent`, `quality_verified`, `method`, and `class_mapping`. Metadata requires
`parameters.tolerance_hours` (0–168). The CLI derives candidate coverage from the
verified delta raster's actual validity mask, never from the AOI outline. Agreement
requires at least 99% reference coverage of that valid footprint and the declared
time tolerance. OPERA is always excluded from independent validation. Empty candidate
sets currently retain `not_validated`. Cloud/shadow masks and product label mapping
must be reviewed upstream; discovery alone cannot qualify a reference.

`context discover --source sentinel-1|sentinel-2|copernicus-ems|opera-dswx-s1|rcm
--area <id> --start <UTC instant> --end <UTC instant>` emits bounded metadata and
response hashes to stdout. Sentinel uses one STAC page and explicitly reports
incompleteness. EMS discovery does not establish product AOI coverage. RCM/OPERA
remain blocked pending verified accessible catalogs/products; no imagery is simulated.

## Verification recorded on 2026-11-15

- Backend: frozen dependency sync, Ruff lint/format and 172 pytest tests passed.
  Tests cover original-artifact preservation, imports, UTC/units/nulls, rainfall
  windows, raster classes/CRS/nodata, DSM slope, reference eligibility, prepared
  store corruption, budgets and HTTP/static equivalence. Warnings are dependency
  deprecations (Starlette test client and Shapely in spatial test fixtures).
- Frontend: ten Node adapter/presentation tests, TypeScript, ESLint and production
  build passed. Tests use the existing TypeScript compiler and Node test runner;
  no new dependency was added.
- Chrome smoke: desktop PT and 390×844 PT/EN, reduced-motion preference, navigation
  to the valley and expanded panel; no JavaScript exceptions or horizontal overflow.
  Physical weak phones, assistive screen readers and a full high-contrast audit remain
  unverified. Browser tests do not establish geospatial validity.
- Offline build/verify ran for all 17 existing real SAR analyses. Their environmental
  sources are unavailable because no new verified environmental inputs were installed.
  No numerical environmental observation or independent reference was fabricated.
- Installed verified package: `frontend/public/data/api/v1` (17 analyses, 19 scenes,
  258 files, 147,535,440 bytes excluding its publication report). Previous snapshot:
  `frontend/public/data/api/v1.backup-16334cb0daa65f05`. Both are ignored by Git.
  All 34 per-analysis context/validation responses matched the local HTTP API exactly.
  OpenAPI: `data/exports/environmental-context/openapi.json` (local, outside Git).
- Original artifact hashes were verified by the context builds. The 123 GB raw-HDF5
  `history verify` was not rerun and no NISAR download/reprocessing was performed.
- No push, remote PR, merge, deployment or visibility/license change was performed.

The full real-input Definition of Done in the source plan is still dependent on
verified environmental imports, source access/license review and independent spatial
reference qualification. The implemented unavailable state is intentional, not evidence
that external sources have no observations.

Environmental timeline markers now use a separate row: station readings are diamonds, rainfall is a time band, and reference products are squares. Dense observations group by UTC day/category for drawing; the panel retains individual observations and times. Comparison order and SAR selection are unchanged.
