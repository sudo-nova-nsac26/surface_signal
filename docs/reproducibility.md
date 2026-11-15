# Reproducibility

Use the [main README](../README.md) for the two read modes. The default public frontend loads the committed verified compact snapshot without Python or satellite downloads. For **scientific reprocessing**, use Python 3.12 and `uv sync --frozen --extra dev` inside `backend/`.
`backend/uv.lock` pins the full dependency graph and hashes; Docker uses uv 0.13.6.
The scientific manifest also records runtime numpy/rasterio/h5py/pyproj/scipy/Pillow versions.

Offline catalog demonstration: `surfacesignal scenes import --file ../docs/evidence/asf-catalog.json` (run from `backend/`) imports **scene metadata only**, not HDF5 data or scientific output. The optional API still serves committed public comparisons via its snapshot fallback if original scientific artifacts are absent; do not confuse that with a newly processed catalog.

For a secure, complete reproduction of the satellite download, begin with the [Earthdata operator guide](earthdata-access.md). Real acquisition identifiers, file sizes, dates and the resolved initial authentication obstacle are documented in
[real-data-execution.md](real-data-execution.md). Real data and generated outputs are Git-ignored.
For reproducible processing obtain those exact release IDs, not a silently substituted release.

Defaults: frequency A, HHHH, delta <= -3 dB, after <= -17 dB, numberOfLooks >=1,
4-neighbor connected components >=9 pixels, one-pixel valid-mask erosion. Pilot AOI max
4 million pixels; actual HDF5 reads are cropped before raster allocation. Full file SHA256
is computed streaming in 1 MiB blocks. Same inputs/metadata/parameters/software yield the
same ID and statistics. Changed software, context, area or catalog metadata changes the ID.

Generated artifacts: before/after-preview.png (fixed display scale), delta-db.tif (float32,
NaN nodata, original projected grid), change-candidates.geojson (EPSG:4326), statistics.json,
evidence.json and manifest.json. The manifest contains hashes of all six other artifacts;
it does not attempt to hash itself. Interrupted runs do not expose completed manifests.

Synthetic pipeline verification: `uv run pytest -q tests/test_pipeline_api.py` creates small
HDF5 in temporary pytest directories and checks repeat execution, expected pixel/area metrics,
PNG/GeoTIFF/GeoJSON export, API access and synthetic labels. They are never presented as NASA
observations or installed automatically into the default API catalog.

To add another AOI, copy the pilot Feature structure, replace geometry with a documented valid
polygon, unique area_id/name/source_url and bounded max_pixels, then search by new area_id.
The offline suite uses a separate synthetic AOI without modifying processing algorithms.

## Derived processing and publication — 2026-11-15

Keep original manifests and TIFFs intact. `derive build --area vale-do-taquari` produces
content-addressed supplementary outputs without reopening HDF5. `publish build` verifies
original processed files and derivatives before export; see [commands](static-publication.md).
Derived identity uses original manifest/delta hashes, algorithm version and parameters.
Identical reruns preserve generation time and bytes. `history verify` still checks the original
history, including streaming raw hashes; it is an offline operator command, never an API request.
