# Sources, terms and transformations

No source below establishes flood classification accuracy.

| Source / organization | URL | Use / status | Terms and limitations |
|---|---|---|---|
| NISAR GCOV / NASA-ISRO, ASF | https://nisar-docs.asf.alaska.edu/gcov/ | Primary gamma0 power specification; diagonal vs complex terms, masks, grid | Dataset citation/access terms apply; PROVISIONAL is not full scientific validation |
| ASF Search / ASF DAAC | https://nisar-docs.asf.alaska.edu/asf-search/ | Real filtered catalog, 19 records; SDK 14.1.0 | HDF5 requires Earthdata; metadata snapshot preserves source IDs/URLs |
| SACE Taquari / SGB | https://sace.sgb.gov.br/bacia_taquari/ | Basin context; portal fetch failed in browsing | Numeric levels not inferred from narrative |
| SGB July 23 bulletin report | https://www.sgb.gov.br/w/com-baixos-niveis-de-chuva-rio-taquari-apresenta-reducao-dos-niveis-em-grande-parte-da-bacia | 16:00 BRT qualitative status for Lajeado/Estrela; CSV paraphrase | Published 23/07 21:21, page updated 21/09; source attribution retained; no blanket reuse license asserted |
| ANA HidroWeb | https://www.snirh.gov.br/hidroweb/acesso-api | Access page checked, no readable text returned; no API integration | No claim of an open unauthenticated observations endpoint |
| OPERA DSWx-S1 / NASA JPL, PO.DAAC | https://www.jpl.nasa.gov/go/opera/products/dswx-product-suite/ | Product documentation reviewed; no aligned raster | Potential agreement reference, not ground truth; shared SAR ambiguities |
| IBGE malhas API | https://servicodados.ibge.gov.br/api/docs/malhas?versao=3 | Attempted Lajeado 4311403 and Estrela 4307807 geometry; both HTTP 503 | No IBGE geometry included; pilot is explicitly analyst-defined |
| Space Apps GO Team | https://github.com/nasa/spaceapps/discussions/1827 | Eligibility timing guidance verified | Written eligibility guidance required before competitive reuse |

Real catalog extent: configured 5 km buffer around (-51.961,-29.467), dates 2026-06-17
through 2026-10-31. Each record preserves full scene metadata, footprint, size, timestamps,
processing release and original catalog properties. The filtered SDK query sets maturity
PROVISIONAL; records without that direct property explicitly say `maturity_basis=query_filter`.
A preliminary point query without maturity filtering returned 20 records; it is **not** the
19-record authoritative filtered AOI snapshot. ASF logged polygon simplification (64→32
vertices, 0.0004-degree proximity) and winding repair for catalog search only. Processing
uses the original AOI polygon, not that search simplification.

GCOV transformations: spatial window, validity/looks filters, grid alignment if needed,
10*log10, temporal delta and explicit heuristic thresholds. Input/output SHA256 and software
versions are captured in manifests. Real transformations have not run because file auth failed.

Code license: pending explicit owner approval; recommendation Apache-2.0 for an eventual
public release (permissive use with attribution/NOTICE and patent grant provisions), subject
to owner review. This document does not grant that license. Third-party Python packages
retain their own licenses; consult pinned package distributions before redistribution.

Legal/Resources pages were requested but failed to load during this execution:
https://www.spaceappschallenge.org/legal/ (502) and
https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/?tab=resources.
Do not treat the plan's statements about those unavailable pages as independently reverified.

GCOV XML specification 1.6.0 was inspected for UTC timestamp encoding, HDF5 dimension
references and mask semantics (0 invalid contributors, 255 outside extent):
https://github.com/isce-framework/nisarqa/blob/main/src/nisarqa/product_specs/1.6.0/nisar_L2_GCOV.xml.
The reader serializes HDF references as dataset paths and normalizes the documented timezone-free UTC field.
