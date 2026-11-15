# Interpretation model — 2026-11-15

Versioned Python rules and bilingual copy produce explanations without LLMs, paid services or
runtime network access. Every analysis story includes observation, measured result, possible
interpretations, limitations, method, scene timestamps/IDs, sources and provenance. UTC timestamps
remain machine-readable; displayed decimal values use Portuguese comma or English point.

General story states: unavailable/no valid data, no retained candidates, small changes (<1% of
valid area), changes, extensive changes (>=50%). These last two boundaries are **editorial extent
rules**, not scientific confidence or severity. Water states distinguish missing valid data,
zero candidates and experimental candidates. Zero is reported only when measured; missing
measurements remain null. Synthetic stories have an explicit illustrative prefix and semantic flag.
Real stories never inherit the synthetic flag. Both remain `not_validated` and not operational alerts.

The capability registry describes general changes, increases/decreases, open-water candidates,
vegetation/agriculture, soil moisture, urban context and unavailable ground motion. The latter
four supply explanation/status only; no invented thematic polygons or physical retrievals.

Timeline grouping reuses the original comparability fields (track, frame, direction, mode,
polarization, release, area). Observations are ordered in UTC; each comparison identifies its
own group, before/after scenes, available analyses, layers, metrics, sources and PT/EN summary.
Regional overviews count observations/comparisons/groups, report temporal range and per-analysis
valid coverage. They never sum overlapping changed areas or infer environmental trends.
Hydrological events are explicitly regional context, not spatial validation.

Add a capability in `processing/capabilities.py`, a prepared-data method, typed response and tests;
only add scientific classifications after the necessary evidence/method exists. Add translations
together in `interpretation/content.py`. Twelve institutional topics are available through stories.
