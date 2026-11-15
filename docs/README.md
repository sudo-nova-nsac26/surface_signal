# SurfaceSignal — technical documentation

**Evaluating the project? Start with the [five-minute reviewer guide](reviewer-guide.md).** It distinguishes working features, scientific limits and future work. The live website is **https://surfacesignal.earth/**. Full setup: [English README](../README.md) · [Portuguese README](../README.pt-BR.md).

## Documentation map

| Area | Reference |
|---|---|
| Reviewer quick path and submission checks | [Reviewer guide](reviewer-guide.md), [Submission checklist](submission-checklist.md) |
| Planned but not implemented | [Future-work register](future-work.md) |
| Get started (static or optional API) | [Project README](../README.md), [Frontend](../frontend/README.md), [Backend operations](backend-operations.md) |
| Runtime architecture | [Architecture](architecture.md), [API contract](api-contract.md), [Backend deployment](backend-deployment.md) |
| Scientific algorithms and interpretation | [Scientific method](scientific-method.md), [General radar changes](general-change-analysis.md), [Interpretation model](interpretation-model.md) |
| Earthdata account and authenticated downloads | **[Full Earthdata / ASF setup and HDF5 processing](earthdata-access.md)** |
| Real acquisition, processing and reproducibility | [NISAR history](real-data-execution.md), [Reproducibility](reproducibility.md), [ASF scene catalog](evidence/asf-catalog.json) |
| Environmental data | [Sources and licenses](data-sources.md), [Acquisition evidence](public-source-evidence.md), [Environmental integration](environmental-data-integration.md) |
| Prepared data and publication | [Snapshot delivery](snapshot-delivery.md), [Static publication](static-publication.md), [Delivery evidence](public-data-delivery-report.md) |
| Analysis and preparation | [Local reports](local-analysis-preparation.md), [Limitations](limitations.md), [Validation](validation.md) |
| Hosting and discovery | [Cloudflare Pages](cloudflare-pages.md), [SEO/GEO](seo-geo-review.md) |
| Contribution and security | [Contributor instructions](../AGENTS.md), [Security](../SECURITY.md), [Apache-2.0 license](../LICENSE), [NOTICE](../NOTICE) |

Documentation here reflects the deployed application, read-only API and offline scientific operations. Temporary implementation plans and handoffs have been retired.

**Scientific boundary:** 17 computed comparisons are not 17 independently field-validated flood maps. File hashes, test results and source citations establish integrity/provenance—not environmental accuracy.
