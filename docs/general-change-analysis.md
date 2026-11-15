# General SAR change analysis — 2026-11-15

`general-radar-change-v1` consumes the existing masked `delta-db.tif`, without opening HDF5.
The measurement is **Δgamma0_dB = after_gamma0_dB − before_gamma0_dB**. GCOV contains
terrain-normalized gamma0 power, not sigma0. The upstream conversion uses 10 log10 only
for real diagonal power terms. [ASF GCOV documentation](https://nisar-docs.asf.alaska.edu/gcov/)
explains the product and covariance channels.

A valid finite pixel at or above +3 dB is an increase; at or below −3 dB is a decrease.
These inclusive, symmetric thresholds are configurable uncalibrated heuristics, not statistical
significance tests. Four-neighbor connected components smaller than nine pixels are excluded
separately for each direction. No smoothing is applied. Invalid pixels never enter the denominator.
The original delta already incorporates upstream masks, grid alignment and edge erosion.
The derivation neither changes nor repeats those steps.

Statistics report raw, retained and discarded pixels/components separately. `unchanged_pixels`
means no **retained** change (includes rejected small components); `below_threshold_pixels`
excludes those components. `changed + unchanged = valid`. Percentages for classifications use
valid pixels as denominator; zero valid pixels yields null percentages and distributions.
Area uses the absolute affine determinant in a projected metre CRS, divided by 1e6 for km².
Geographic or non-metre grids are rejected. `max_pixels` limits allocation before raster reads.

Outputs are `general-change.geojson`, `radar-increase.geojson`, `radar-decrease.geojson`,
`general-statistics.json`, `general-evidence.json`, and a derived `manifest.json`.
Polygons follow pixel edges, transform to EPSG:4326, and carry class, pixel count, area and
synthetic/validation markers. Distribution statistics include mean, median, extrema and
5/25/50/75/95 percentiles, over valid pixels and each retained class. No environmental label
is assigned to a generic increase/decrease.

Storage is `data/derived/<analysis_id>/<derived_id>/`, selected by `current.json`.
Identity binds original analysis ID, original manifest hash, delta hash, algorithm version and
parameters. The manifest adds generation UTC time and output hashes. Changing parameters creates
another directory; reruns verify and reuse the existing result. Historical `artifacts/` are untouched.
Generation time is provenance, not part of scientific identity. Bump the algorithm version for
any change in scientific semantics. CLI writers run serially; distributed writers are outside scope.

The water algorithm remains `open-water-change-v2`. It also requires low later return and has
its own recorded thresholds and component filter; its polygons need not be a subset of the
**filtered** general polygons when parameters differ. It offers experimental possible open-water
change candidates, never confirmed flooding. Components are pixel groups, not separate events.
