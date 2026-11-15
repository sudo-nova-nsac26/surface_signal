# Data inventory, transformations, provenance and terms

This is the **current actual-source inventory**, not a list of hypothetical
integrations. All environmental inputs were acquired using public HTTPS access;
NISAR HDF5 acquisition required Earthdata. The evidence in
[public-source-evidence.md](public-source-evidence.md) includes native crop
SHA256, request ranges, units, temporal coverage, product versions and license metadata.

| Product | Real imported input and scientific treatment | Boundary / credit |
|---|---|---|
| **NASA–ISRO NISAR L2 GCOV**, via ASF | **19 provisional scenes**, **17 compatible temporal comparisons**, approx **131.39 GB** original HDF5. Bounded AOI GCOV power reads, validity/looks masks, alignment, gamma0 dB deltas and change polygons | [GCOV documentation](https://nisar-docs.asf.alaska.edu/gcov/), [ASF search](https://nisar-docs.asf.alaska.edu/asf-search/), [NASA mission](https://science.nasa.gov/mission/nisar/data/). Heuristic signals ≠ confirmed flood; ASF access/attribution terms apply. |
| **CHIRPS v3.0 final SAT**, UCSB Climate Hazards Center | **57 native daily AOI crops**; consolidate estimated precipitation per complete preceding **UTC date labels** (1/2/3-day summaries) | [Product page and terms](https://www.chc.ucsb.edu/data/chirps3). 0.05° precipitation estimate is neither rain-gauge verification nor exact acquisition-hour rainfall. v3 SAT uses IMERG Late in its production, **not a separately ingested GPM dataset**. |
| **JRC Global Surface Water v1.5** | Native historical occurrence raster AOI crop; percent water occurrence **1984–2024**, 30 m nominal | [JRC download and acknowledgement](https://global-surface-water.appspot.com/download); historical frequency is **not 2026 flooded area**. |
| **ESA WorldCover 2021 v200** | Native **10 m** crop: water, trees, crops, built area etc. | [ESA product / CC BY 4.0](https://esa-worldcover.org/en/data-access); depicts 2021, not a current 2026 class or change. |
| **Copernicus DEM GLO-30** | Two public tiles cropped/mosaicked to AOI, DSM surface height and slope | [AWS open dataset](https://registry.opendata.aws/copernicus-dem/), [Copernicus obligations](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM). DSM includes buildings/vegetation; not landslides, ground movement or river stage. |
| **IBGE** | Official **2022** municipal meshes + names, intersecting Cruzeiro do Sul, Estrela and Lajeado | [IBGE malhas](https://servicodados.ibge.gov.br/api/docs/malhas). 2023/2024 queries failed but the 2022 query succeeded; don't infer residents affected. |
| **SGB / SACE Taquari** | Source-dated **qualitative** hydrological bulletin/CSV | [SACE](https://sace.sgb.gov.br/bacia_taquari/), [SGB bulletin](https://www.sgb.gov.br/w/com-baixos-niveis-de-chuva-rio-taquari-apresenta-reducao-dos-niveis-em-grande-parte-da-bacia). Do not invent numeric station levels or spatial flood polygons. |

## Technical steps

1. **Source acquisition:** record official URL, product/release, retrieval and observation times, AOI, hashes, ETags/HTTP ranges and permission metadata. The public context provider crops public raster sources to the configured bounded AOI. Raw source products stay out of Git.
2. **SAR comparison:** select same-track/frame, direction, polarization, release and mutually comparable coverage. Read the bounded projected window, filter invalid, nonpositive and fill pixels, apply looks/GCOV mask semantics. Align in **linear power** before converting to dB: `gamma0_dB = 10 log10(gamma0_power)`, `delta_dB = after - before`.
3. **Candidate polygons:** the exploratory open-water heuristic requires a **decrease ≤ −3 dB** and low subsequent power (typically **≤ −17 dB**) with minimum **9 pixels** per 4-connected component. Generic signal increases ≥ +3 dB and decreases ≤ −3 dB are separate layers, **not environmental classifications**. Exact thresholds and software versions are recorded per analysis manifest.
4. **Environmental context:** aggregate CHIRPS by prior complete labeled days; summarize historical JRC water frequency; map WorldCover land-cover fractions; use DSM elevation/slope; intersect IBGE municipality geometries; join dated SGB qualitative reports. Keep unavailable numbers as `null`.
5. **Publication:** preserve original numerical statistics/validation markers, original-source and export hashes. The **compact** JSON/GeoJSON retains a subset of larger polygons only for browser rendering; omitted small polygons invalidate any attempt to recompute areas/counts from the display layer. Full vectors require separately installed verified outputs.

## Never claim these are actual ingested sources

Separate NASA GPM IMERG rasters, ANA live gauge feeds, MapBiomas/GEE,
RCM, Sentinel/OPERA independent spatial reference images, Open-Meteo and ERA5-Land
are **not** inputs to the published 17 analyses. Available adapters,
historical implementation plans and data-source links do not imply acquisition.

## Map and interface resources (not scientific validation)

OpenFreeMap/OpenStreetMap/OpenMapTiles, MapLibre GL JS, Mapzen terrain,
optional **Esri World Imagery** 2D basemap, Atkinson Hyperlegible and other fonts
are display/interface resources. Their licensing and attribution are separate
from the underlying scientific inputs and separate from the source-code license.

## Legal boundary

The project's **Apache-2.0** license covers original project software/docs.
It does **not** relicense NISAR, CHIRPS, JRC, ESA, Copernicus, IBGE,
SGB, map tiles, typography or third-party visual assets.
Review provider usage/redistribution terms before packaging or hosting
their native rasters. See [NOTICE](../NOTICE), [source evidence](public-source-evidence.md)
and [validation limits](validation.md).
