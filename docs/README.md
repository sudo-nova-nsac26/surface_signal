# SurfaceSignal documentation

Start at the [main project README](../README.md) or the [Portuguese README](../README.pt-BR.md). The public application is **https://surfacesignal.earth**.

## Current documentation

| Purpose | Document |
|---|---|
| Running without Python or with FastAPI | [Main README](../README.md#run-it-locally-two-supported-modes), [backend operations](backend-operations.md), [frontend README](../frontend/README.md) |
| Architecture, static/API boundary | [Architecture](architecture.md), [API contract](api-contract.md) |
| Actual data and source rights | [Data sources](data-sources.md), [acquisition evidence](public-source-evidence.md) |
| SAR calculations and scientific QA | [Scientific method](scientific-method.md), [general SAR changes](general-change-analysis.md), [validation](validation.md), [limitations](limitations.md) |
| Actual processing and provenance | [Real-data execution](real-data-execution.md), [ASF catalog](evidence/asf-catalog.json), [reproducibility](reproducibility.md) |
| Compact/full snapshot distribution | [Snapshot delivery](snapshot-delivery.md), [public delivery evidence](public-data-delivery-report.md), [static publication](static-publication.md) |
| Cloudflare Pages | [Cloudflare deployment](cloudflare-pages.md) |
| Search / AI discoverability | [SEO and GEO review](seo-geo-review.md) |
| Security and licensing | [Security](../SECURITY.md), [Apache-2.0](../LICENSE), [attributions](../NOTICE) |

### Dated development records (archive; not current instructions)

The historical `backend-mvp*`, `implementation-status.md`, `frontend-handoff.md`,
`frontend-data-integration-plan.md`, `superpowers/` and old execution plans describe earlier implementation phases.
They are retained where valuable as technical evidence but **do not override the current code, real source acquisition reports and main README**.

The [prototype provenance](prototype-provenance.md) is deliberately preserved.
Commit dates and earlier work must remain truthful; reorganizing a README
does not grant competition eligibility or change actual development chronology.
The separate software license cannot establish clearance by the NASA Space Apps GO Team.

### Important limitation

17 computed radar comparisons are **not** 17 independently verified flood maps. Software tests, file hashes, source citations and compact visualizations do not establish field/spatial accuracy.
