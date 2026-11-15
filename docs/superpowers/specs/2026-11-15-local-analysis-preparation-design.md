# Local analysis and preparation plans

Date: 2026-11-15. Status: proposed design; implementation approval pending.
Branch: `feature/local-analysis-preparation-plans`, based on `develop`.

## Intent and agreed scope

Help residents and municipal teams understand observed changes around Lajeado and
Estrela in the configured Vale do Taquari area, and prepare using traceable information.
The owner selected local analysis and preparation plans as the first delivery and
explicitly excluded all frontend work. Both audiences share the same evidence but
receive different explanations and proposed tasks.

The supplied Dancing with the SARs challenge asks for interactive use of NISAR,
accessible visualization, physical hypotheses and actionable insights. Prediction
is a possible future application, not a prerequisite of this backend delivery.
The challenge text was supplied in the conversation; the official page could not
be fetched during the initial research.

## Current foundation

Backend 0.2.0 already provides compatible scene grouping, experimental open-water
candidates, general change derivatives, statistics, bilingual deterministic stories,
a read-only FastAPI service and verified offline publication. The documented local
delivery includes 19 scenes and 17 comparisons. These are processing results,
not an independent validation of environmental interpretation.

Reuse `api/service.py`, `interpretation/`, `processing/general_change.py`,
`storage.py` and the CLI/publication patterns. Do not modify raw data, original
`artifacts/`, existing algorithms or previous derived outputs.

## Approaches considered

1. **Local analysis and preparation:** combine prepared observations with documented
   local context and a curated, deterministic action catalog. Provides useful,
   inspectable outputs using existing data. Selected by the owner.
2. **Analysis and hypothetical scenarios:** explore preparation under explicitly
   simulated conditions. Useful later, but requires additional assumptions and
   careful separation from observations. Deferred.
3. **Analysis and experimental prediction:** define a forecast target, assemble
   suitable histories and test against simple baselines on held-out events.
   Additional data and evaluation are prerequisites. Deferred.

## Goals and exclusions

- Deliver local evidence reports and preparation plans for residents and municipal
  teams, in Portuguese and English, through offline CLI artifacts and additive GET
  endpoints. Export JSON and a human-readable Markdown report.
- Make every proposed action explain its evidence, intended audience, source,
  limits and review status. Absence of detected changes never means safety.
- Keep factual observation, possible physical interpretation, regional context and
  preparation guidance separately typed and separately described.
- Make missing context visible and keep unmeasured quantities null.

No changes, generated snapshots, dependency installs, builds or other writes under
`frontend/`. No prediction, operational monitoring, notifications, evacuation orders,
route recommendation, confirmed damage/flood labels, population impact estimates,
new public license, deployment, push or competition merge. Written GO Team clearance
remains required before competition integration. No LLM or network call at runtime.

## Proposed first-delivery behavior

These implementation choices are proposals, not additional owner decisions.

### Local evidence report

An offline build consumes selected, verified original manifests and current general
derivatives for one configured area. Default selection excludes synthetic analyses;
an explicit illustrative mode must never mix synthetic and real reports silently.
The report includes acquisition dates, comparable acquisition groups, method and
parameter variants, per-analysis measured areas, valid coverage, water candidates,
possible explanations, limitations and original evidence references.

Keep the first delivery at per-comparison resolution: no recurrence, persistence,
continuous trends or cumulative area statistics. Multiple parameter variants remain
separate; ascending and descending observations remain separate. No automatic
choice of a supposedly authoritative variant. Reference the exact source scene
times rather than presenting a historical report as the present situation.

### Optional local context

Accept an explicitly supplied, local GeoJSON FeatureCollection with source metadata
for named places or public facilities. Do not download context automatically.
Required provenance includes source URL, publisher, retrieval time, dataset version
or reference date, file SHA256 and a redistribution/usage statement. Features need
stable IDs, names, kinds and valid EPSG:4326 geometries; reject invalid coordinates,
unsupported geometry types, duplicate IDs and missing attribution. Initially support
Point, Polygon and MultiPolygon, with no implicit buffers or proximity radius.

Intersect context features with each selected analysis's general-change union and
open-water-candidate union separately, in a projected metric CRS. Remove duplicate
candidate coverage within each layer before computing polygon overlap area. Point
membership and polygon overlap are different typed results. Boundary-only polygon
contact is not positive area overlap. Never add areas from different dates or layers.
These relations mean observed geometric overlap, never damage, closure or occupancy.

Only report a measured non-overlap where the feature is fully inside that
comparison's valid observation footprint. If a trustworthy valid footprint is not
available, do not claim negative observation coverage: report coverage unknown and
allow only positive intersections, with an explicit limitation. Missing context
produces `unavailable`, not an empty list presented as no local relevance.

No real neighborhood boundaries, facility positions, closure status or affected
people are invented. The real-data run may therefore deliver area-wide evidence
and generic preparation guidance while stating local context is unavailable.

### Preparation catalog and plan assembly

Use versioned rules and bilingual templates, following the existing interpretation
engine. Each catalog entry contains an ID, audience, objective, proposed task,
why it appears, required evidence IDs, source IDs, rule version and review status.
Official preparation recommendations must be checked against primary government
sources during implementation and stored with retrieval date and reviewed wording.
Links alone do not constitute reviewed guidance; do not copy unsupported advice.

Separate universally applicable preparation guidance from observation-conditioned
municipal verification tasks. General guidance remains explicitly generic when
observations or local context are unavailable. Municipal tasks can suggest reviewing
records or checking a named facility where an intersection exists, without claiming
that the site was affected. Such tasks are proposed by SurfaceSignal, not attributed
to an authority as official instructions. No numeric severity/confidence score.

Plans carry `proposed` status and require human adoption; they do not claim official
approval or assign work to a real person. Residents receive understandable context
and verified preparation material. Municipal teams receive evidence review and
verification tasks with suggested responsible roles, not invented staff assignments
or deadlines. No task instructs a resident to inspect a potentially affected place.
Unknown measurements, missing sources and unavailable context stay explicit.

## Storage, provenance and resource limits

Add a dedicated backend package for report models, rules, context processing,
generation and prepared-store access; exact module decomposition is the builder's
choice. Pydantic v2 models forbid extra fields, non-finite measures and ambiguous
audience/language/status values, following project conventions.

Write only under `data/preparation/<area_id>/<report_id>/`, with an atomically
updated current pointer after complete verification. Keep prior reports immutable.
Canonical content identity binds source manifest and derivative hashes, selected
analysis IDs, context hash or explicit absence, catalog/rule/content versions,
parameters and language outputs. Generation time belongs in provenance, not the
scientific identity. Preserve source dates and hashes in each output's provenance
or manifest references. Verify complete inventory and hashes on reuse and reads.

Enforce positive explicit byte, feature and geometry-coordinate budgets before
expensive processing. Process analyses serially and avoid loading all temporal
vectors at once. Fail on exceeded budgets; never silently truncate evidence.
Reject symlink/path escapes and unsafe IDs. Use atomic staging, preserve a previous
valid current pointer on failure and detect stale source/derived/context identities.
Do not open HDF5, download scenes or reprocess raster data for this delivery.

## CLI, API and export

Proposed CLI: `preparation build --area vale-do-taquari`, optional context path,
explicit budgets and optional illustrative mode; `preparation verify --area ...`.
One build prepares both audiences and both languages. Reuse verified source outputs
and fail clearly if required source artifacts are corrupt. No-data areas produce
an explicit unavailable evidence state with generic sourced guidance only.

Proposed additive GET routes:

- `/api/v1/areas/{area_id}/local-analysis?lang=pt|en`
- `/api/v1/areas/{area_id}/preparation?audience=residents|municipal&lang=pt|en`

HTTP reads prepared files only. Unknown areas return 404, a known area with no build
returns 404 with a specific not-prepared error, corrupt/stale prepared data returns
sanitized 503, invalid queries return 422 and writes remain unsupported. Public
responses contain no private filesystem paths. Existing endpoint behavior is retained.

The CLI report directory is the initial standalone deliverable. Extend offline static
publication with an opt-in inclusion of an existing verified preparation build;
default publication remains compatible. Validate all new URLs and hashes within
the existing export ceiling. Exercise exports only into temporary or backend data
paths; never write under `frontend/` in this branch.

## Verification and acceptance

- Synthetic geospatial fixtures exercise positive/negative/unknown coverage, points,
  polygon overlap, duplicate geometry, boundary-only contact and missing context.
- Rule tests establish that missing evidence cannot generate a location-specific
  action; zeros differ from null; generic guidance stays generic; candidate changes
  never become confirmed flood/damage, safety or operational instructions.
- Tests cover comparable groups, parameter variants, bilingual parity, synthetic
  isolation, provenance hashes, reproducibility, budgets, stale/tampered data,
  path confinement and interrupted builds.
- CLI/API/static integration tests cover typed contracts and errors; HTTP cannot
  trigger generation or network access. Existing clients retain existing responses.
- Run project backend sync, Ruff checks/format and full pytest suite. No frontend
  commands or tests are part of this backend-only change.
- Run one bounded offline build on available real prepared analyses, verify its
  artifacts and inspect both audiences/languages. Record absent external context and
  independent spatial validation honestly; label technical verification accordingly.
- Update backend/API/method documentation and append the backend status in root
  `AGENTS.md` in the implementation change. Preserve historical handoff statements.

Success means reproducible, traceable local reports and preparation proposals can
be inspected via CLI and read-only API, with explicit uncertainty and no frontend
changes. It does not mean a validated forecast or confirmed environmental impact.

## Decisions left to the builder

Choose module layout, exact schema field names, conservative default budgets and
test fixture organization. Select official preparation sources after checking
their current contents; omit entries that cannot be substantiated. Record sources
and any unavailable optional context in the implementation handoff. Do not expand
to additional audiences, forecasts, automated communications or frontend work.
