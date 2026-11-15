# Limitations

- Exploratory private software; no eligibility claim, no operational alerts,
  evacuation guidance, flood prediction or individual risk assessment.
- No real HDF5 inspected/processed yet; Earthdata auth unavailable and observed HTTP 403.
- No real spatial/field validation; precision, recall, IoU and F1 not reported for the pilot.
- Low-return thresholds are not universally calibrated and miss urban/vegetated flooding.
  Surface moisture, vegetation, wind, shadow and residual terrain may mimic or obscure change.
- NumberOfLooks, documented mask 0/255 and explicit fill checks do not fully interpret every GCOV QA/mask convention.
- Whole-scene download may consume ~7 GB per selected file; remote streaming is unverified.
- API is read-only and offline; JSON catalog loads into memory. Sequential CLI processing only.
- GeoTIFF is not guaranteed COG; no tiles, frontend, chatbot, remote jobs or operational monitoring.
- AOI is a documented analyst buffer; it is not an official municipal/basin boundary.
- SGB context is qualitative; no numeric levels invented. Historical maps cannot label 2026.
- Rulesets blocked by current private repository plan; templates and manual PR review are not
  equivalent to enforced protections. Code license and public visibility remain unapproved.

## Backend MVP — 2026-11-15

General increase/decrease maps are exploratory signal observations. No ground-motion, soil
moisture retrieval, deforestation or urban damage map is produced. Small components discarded
by filtering are counted explicitly. “Unchanged” means no retained change under these settings,
not an invariant surface. Regional histories do not sum overlapping area or mix ascending and
descending geometries into a continuous quantitative trend. Real processing completion and
verified hashes are not scientific validation. The static package must be installed separately
on another machine; runtime Python is unnecessary in static mode.
