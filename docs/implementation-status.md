# Implementation status

Draft PR: https://github.com/matbforge/nsac26-dancing-with-the-sars/pull/1
Branch: poc/backend-validation, targeting develop. No merge, visibility or license change.

| Phase | Result |
|---|---|
| 0 audit | Real GitHub/API/source checks; private and empty verified; eligibility disclosed |
| 1 bootstrap | main/develop/prototype created; rulesets HTTP403, templates only |
| 2 API/models | 11 read-only routes, Pydantic contracts, pagination, errors, CORS, OpenAPI |
| 3 catalog/reader | 19 real PROVISIONAL scenes; bounded crop/inspection; real HDF5 blocked by Earthdata auth |
| 4 comparison | Implemented, synthetic verification; no real measured change reported |
| 5 evidence/context | Exports and SGB qualitative context integrated; spatial/field validation not executed |
| 6 quality | 41 tests passed, 90% statement coverage, Ruff lint/format passed; CI and Docker build verified for initial implementation, correction commit is checked separately |

Local commands: `uv run --project backend pytest backend/tests -q --cov=surfacesignal
--cov-report=term-missing`; `uv run --project backend ruff check backend`; `uv run --project
backend ruff format --check backend`. One upstream Starlette/httpx TestClient deprecation
warning remains; no test failures. HTTP subprocess smoke passed all six checks, 11 OpenAPI
paths and 19 offline catalog records. Cross-command host loopback smoke initially failed;
a same-process startup/smoke run confirmed the application works in this execution environment.

Initial real CI (all steps, including Docker build, successful):
https://github.com/matbforge/nsac26-dancing-with-the-sars/actions/runs/43526645709
Latest runs and exact SHAs:
https://github.com/matbforge/nsac26-dancing-with-the-sars/actions/workflows/backend-ci.yml

## Independent review and fixes

Read-only independent code review found four important issues. Each was reproduced in a
failing regression, corrected and followed by the green full suite:

- NISAR timezone-free UTC timestamps: normalize documented UTC before aware comparison.
- HDF5 dimension references: serialize references/structured values as deterministic paths.
- Container readability: publish completed JSON/artifacts as0644, analysis directories0755;
  private temporary staging is retained until publication. Host parent directories still need traversal.
- Documented mask quality: exclude invalid/partially focused contributors0, outside extent255,
  and explicit fill; synthetic fixtures now use valid subswath11.

Algorithm is now open-water-change-v2, package0.1.1: older cache IDs are not silently reused.
Three additional observations were promoted to acceptance issues because the plan explicitly
requires safe budgets, structured503s and local availability: finite-positive download limits,
validated catalog envelopes, and computed API local_available. Each has a regression test.
Local availability means matching file presence/known size, **not rehashed scientific integrity**.

## Decisions and remaining boundaries

- GitHub CLI had no login; use connected GitHub publication. Cost: local authoring commits and
  connector-created remote commits have distinct IDs; linked remote history is authoritative.
- Plan phases were used as implementation tasks; the attached plan has no executable test briefs.
- IBGE503: analyst-defined5km UTM buffer around supplied point; not administrative coverage.
- Earthdata missing/HEAD403: real catalog retained, real raster execution deferred; no real accuracy claim.
- SGB qualitative article: numerical level null; sourced station status only.
- Streaming: not verified on concrete products; selective full-file download fallback implemented.
- Reviewer could not judge authenticated download/actual HDF5, event interpretation/accuracy,
  real spatial/field validation or container runtime in this host. These remain explicit validation
  gaps; no claim of successful real-file processing or end-to-end Docker data serving is made.
- Remote CI/governance was checked by the primary executor: first build green; main/develop
  rulesets remain BLOCKED_BY_PLAN. Keep draft and manually review before any integration.

No reviewer findings remain knowingly unfixed in implemented scope. The TestClient deprecation
and actual-data/runtime verification are disclosed limitations, not hidden passing results.
