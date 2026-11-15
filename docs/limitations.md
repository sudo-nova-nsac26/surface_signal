# Scientific, operational and publication limitations

- SurfaceSignal is a **published exploratory science/communication platform**, not an official real-time warning system, evacuation guide, insurance assessment, individual risk forecast or reliable flood map.
- The current pilot processed **19 real NISAR GCOV acquisitions / 17 comparisons**. Processing success does not establish independent environmental validation.
- NISAR products are **provisional**. Gamma0 decreases can also reflect soil moisture, vegetation, shadow/layover or acquisition effects. Urban/vegetated flooding can increase radar backscatter and be missed by low-return thresholds.
- Heuristic thresholded **possible open-water change candidates** are not verified flooding. Separate generic radar increases/decreases do not prove landslides, deforestation, erosion, ground motion or infrastructure damage.
- **No independently validated real spatial reference or field survey** exists for the displayed candidates; no real pilot precision, recall, IoU or F1 is claimed. SGB bulletins and historical raster products are context only.
- CHIRPS v3 SAT estimates do not establish station rain at the acquisition hour. JRC occurrence covers 1984–2024; WorldCover classes describe 2021. Copernicus DSM is surface height including objects, not a flood level.
- IBGE **2022** municipal boundaries are contextual and do not mean the analyst-designed pilot AOI is an official city or flood boundary.
- The committed compact **GeoJSON is simplified/trimmed for visualization**, so feature counts/areas cannot be recomputed from it. Scientific statistics and hashes preserve original measurements. The full vectors are a separate optional package.
- Missing measurements stay `null`, not invented zeroes. Provisional measurements and time windows have explicit limitations.
- The read-only FastAPI and static site **never run HDF5 analysis inside an HTTP request**. Raw scientific acquisition can be large (>131 GB) and requires local authorized Earthdata access. This is not needed for a clone of the frontend.
- External tiles/relief/imagery may fail independently of the committed science snapshot.

[Method](scientific-method.md) · [Validation](validation.md) ·
[Actual sources](data-sources.md) · [Delivery](snapshot-delivery.md).
