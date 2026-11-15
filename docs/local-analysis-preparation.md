# Local analysis and preparation — 2026-11-15

This offline backend module produces traceable local summaries and optional
human-reviewed preparation suggestions for residents and municipal teams from prepared
Taquari Valley comparisons. Prepared results can be read through the API and published
for the frontend. It is **not** a forecast, emergency-alert service or independently
validated environmental impact assessment.
Generation uses no network, LLM, new dependency, raw HDF5 or raster reprocessing.

## Run offline

From repository root, after the original analyses and general derivatives exist:

```sh
uv sync --project backend --frozen --extra dev
uv run --project backend surfacesignal --root "$PWD" preparation build --area vale-do-taquari
uv run --project backend surfacesignal --root "$PWD" preparation verify --area vale-do-taquari
```

Real analyses are selected by default. `--illustrative` selects **only** synthetic
analyses, never a mixture. Both languages and audiences are prepared together.
The build writes immutable `data/preparation/<area>/<report_id>/` directories and
atomically switches `current.json` only after verification. Writers must run serially.
Old reports are retained; a corrupt existing report is never silently overwritten.

Outputs: `local-analysis.pt.json`, `local-analysis.en.json`,
`preparation.{residents,municipal}.{pt,en}.json`, `report.pt.md`, `report.en.md`,
`manifest.json` and an optional exact-byte `context.geojson` snapshot.
No artifacts from the real run are committed to Git.

## What the reports mean

Each observation retains its exact pair, acquisition group, parameter variant,
measured areas, possible interpretations, alternatives and original/derived hashes.
No recurrence, persistence, future state or cumulative area is inferred. Areas from
different comparisons/layers are not added. Missing measures remain null.

Plans have `status=proposed`, `review_status=human_review_required` for each task and
`is_operational_alert=false`. Residents receive general preparation advice supported
by official sources; it does not depend on satellite detections. Municipal teams
receive general preparation review tasks plus conditional local verification proposals
only where a supplied context feature intersects an observed change. Each conditional
task identifies its feature, exact comparison and sources. No residents are instructed
to inspect potentially affected sites. No actual staff, deadlines, closures, damage,
affected people, safe places or routes are asserted.

Sources reviewed on 2026-11-15: MDHC's 2025 human-rights guide (printed pp. 61, 82, 84),
Santa Maria's general preparation material, and MIDR's 2026-11-07 preparation note.
Exact URLs, publishers, applicability and locators live in `preparation/content.py`
and each plan's source registry. The hash covers the curated content and source
records, **not** the remote webpages' bytes. No network source is refreshed by a GET
or build: changes require editorial review and an updated content version.
Santa Maria operational procedures are not transferred to Lajeado/Estrela.

## Optional local context

Pass `--context /path/to/context.geojson`. Import supports EPSG:4326 Point, Polygon
and MultiPolygon features without a CRS override. Every feature needs nonempty string
properties `id`, `name`, `kind`; IDs must be unique. Top-level `metadata` is required:

```json
{
  "source_url": "https://publisher.example/dataset",
  "publisher": "Actual publisher",
  "retrieved_at": "2026-11-15T12:00:00Z",
  "reference_date": "Actual dataset reference date",
  "version": "Actual dataset version",
  "usage_statement": "Actual usage/redistribution terms",
  "synthetic": false
}
```

This is a schema example, not a real dataset. Synthetic context is accepted only in
illustrative mode. The importer rejects missing provenance, invalid/empty geometries,
out-of-range or non-finite coordinates, duplicate IDs and symlinks. File SHA256 is
computed during import; the exact snapshot is retained, so later reads do not depend
on a user's import path. Context is not downloaded automatically.

Each layer's candidate geometry is unioned before projected overlap measurement,
so duplicate polygons do not double area. Points report membership without area;
polygon boundary contact alone is not positive overlap. There is no trusted vector
valid-coverage footprint in this delivery: **negative intersection is unknown**, not
false or zero, and never a safety statement. Overlap itself does not confirm impact.

Defaults: `--max-input-bytes 25000000` per loaded input,
`--max-features 50000`, `--max-coordinates 1000000` per processed collection,
`--max-output-bytes 25000000` including the manifest and optional snapshot. All
budgets must be positive integers. GeoJSON byte size is checked before parsing;
feature/coordinate limits are checked before geometry work. Analyses are processed
serially. Exceeding a limit fails without replacing the previous current pointer.

## Read-only API and publication

- `GET /api/v1/areas/{area}/local-analysis?lang=pt|en`
- `GET /api/v1/areas/{area}/preparation?audience=residents|municipal&lang=pt|en`

Defaults are Portuguese and residents. HTTP verifies prepared metadata/vector inputs,
current source identities, hashes and exact inventory. It never builds reports or
opens raw/raster files. Unknown areas return 404; known areas with no prepared report
return 404 `preparation_not_prepared`; stale/corrupt reports return sanitized 503;
invalid queries return 422. Existing endpoint responses are retained.

Opt in with `publish build --include-preparation`. The selected analysis IDs must
exactly match the prepared report; real-only publication rejects illustrative reports.
Default publication is unchanged. The export includes six typed report/plan JSONs
and the preparation manifest, inside the existing byte budget and URL verification.
Standalone Markdown/context snapshot files remain in the offline report directory.
Generate exports outside `frontend/` when working on this branch.

## Evidence and remaining limitations

The initial real smoke run used 17 comparisons spanning 2026-06-17 through 2026-10-19.
Both local reports and all four plans were loaded and verified; all six real GET
responses returned 200. Report `db24e7a6d1b134589193bce4` contains 471,119 bytes including
the manifest. A temporary real-only static export with preparation contained 228
payload files (147,734,837 bytes excluding publication report); identical reuse passed.
The temporary static export was removed after the smoke check. External local context
was **unavailable**, so there are no invented named facilities or location-specific
tasks: resident plans have four general actions, municipal plans have two.

Technical integrity is not environmental validation. No contemporaneous independent
spatial reference is introduced here. Real neighborhood/facility context remains an
optional sourced input; human review and adoption remain separate from data processing.

Final checks on 2026-11-15: frozen development sync, Ruff lint and format check
passed; full backend suite **151 passed**. One existing Starlette/httpx TestClient
deprecation warning remains. Independent review found two important issues, both
reproduced with failing regressions and fixed: source size checks now precede full
verification, and preparation identity reads area/analysis bytes without trusting
timestamp/size metadata caches. The real report's identical offline reuse and
verification passed after these fixes. This dated backend verification does not establish subsequent frontend or production performance.
