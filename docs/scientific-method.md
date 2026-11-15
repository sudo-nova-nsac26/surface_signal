# Scientific method — exploratory version 1

NISAR GCOV diagonal covariance terms represent gamma0 power. The reader accepts real
HHHH, HVHV, VVVV, VHVH, RHRH and RVRV only; off-diagonal complex terms are rejected.
Frequency A/B, channel availability, projection and coordinate arrays are read per file.
See https://nisar-docs.asf.alaska.edu/gcov/ and its linked product specification.

1. Discover `dataset=NISAR`, `processingLevel=GCOV`, `dataMaturity=PROVISIONAL` using ASF's
   paginated generator. Preserve complete catalog properties and filename-derived mode,
   polarization and release, explicitly recording maturity inferred from the query filter.
2. Pair only known identical track, frame, orbit direction, bandwidth mode, polarization,
   release and area. Require increasing acquisition times. Never mix ascending/descending
   geometry as a pixelwise baseline. July 11/23 are exploratory candidates, not assumed flood labels.
3. Verify file identity against catalog (filename for real files; track, frame, direction,
   product type and acquisition time in HDF5). Read only the AOI bounding window with a
   configurable pixel budget **before** loading raster arrays. Default maximum: 4 million pixels.
4. Use coordinate centers and half-pixel offsets to construct north-up georeferencing;
   normalize reversed axes; reject irregular grids. Rasterize polygon with pixel-center
   inclusion. Grid spacing is not effective spatial accuracy. AOI CRS is EPSG:4326.
5. Exclude nonfinite/nonpositive/fill power, mask 0 (invalid/partially focused contributors), 255 (outside extent), explicit `_FillValue`, and numberOfLooks
   below configured minimum (default 1). The GCOV mask describes the multilooking ensemble;
   **zero is not interpreted as water**. Positive mask values represent valid subswaths per GCOV 1.6.0. Other quality semantics and layover/shadow are not
   interpreted by this version. Missing numberOfLooks/mask reduces quality assurance and is
   visible through inspection and applied-filter metadata.
6. Reproject AFTER linear power to BEFORE grid only if CRS/transform/shape differ, using
   bilinear interpolation and nodata. Never interpolate dB as if it were linear power.
   Use `10 log10(power)`, then `delta_dB = after_dB - before_dB`. Both dates must be valid.
   Default one-pixel erosion removes coverage/nodata boundaries; exact setting is in manifest.
7. Baseline: backscatter decrease <= -3 dB. Exploratory open-water candidate: that decrease
   AND after backscatter <= -17 dB. Remove connected components under 9 pixels using 4-neighbor
   connectivity. Thresholds are configurable **uncalibrated heuristics**, particularly channel-dependent.
8. Compute valid and candidate area using determinant of projected metric transform, km²
   and candidate percentage over shared valid area only. Polygons are un-smoothed pixel-edge
   boundaries transformed to EPSG:4326. No urban/vegetated flood detector is claimed.
9. Export deterministic PNG (fixed -30..+5 dB scale), GeoTIFF (not claimed as COG), GeoJSON,
   statistics, evidence and manifest. Hash input files and outputs. Manifest includes algorithm,
   dependency versions, area geometry, thresholds, alignment and sourced hydrological context.

Low return can result from smooth water but also shadow, land-cover changes and other causes.
Flooded vegetation and urban double-bounce can INCREASE return and are missed by this detector.
Wind can brighten water. Provisional calibration, residual terrain, soil moisture and
acquisition/event offsets limit interpretation. No probability, accuracy or operational alert
is derived from these thresholds. `validation_status=not_validated` is intentional.

## General signal observations — MVP 2026-11-15

The water method above is preserved. A separate `general-radar-change-v1` uses the already
masked delta GeoTIFF to classify increases >=+3 dB and decreases <=−3 dB. Both thresholds
are inclusive heuristic choices, with independently filtered four-neighbor components >=9
pixels. It does not infer any environmental class. See [full method and accounting](general-change-analysis.md).
Observation → detection → environmental hypothesis → independent validation remain distinct.
