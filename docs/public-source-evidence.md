# Public source acquisition evidence — 2026-11-15

This records an actual credential-free HTTPS acquisition for the configured
`vale-do-taquari` AOI, not a proposed adapter. No Earthdata, Google Earth Engine,
ANA or NISAR imagery download was needed. Historical context does not establish
flood truth, current conditions, confirmed impacts or independent validation.

The AOI bounds are `[-52.0126, -29.5122, -51.9094, -29.4218]`, approximately
78.46 km². The real local catalog contains 19 scenes from 2026-06-17 through
2026-10-19; the July story pair is included. Acquisition was serial through the
public source provider. All five imports have `synthetic=false` and explicit
attribution and permission metadata. Failed preliminary probes were retained in
the work record below; they did not prevent successful acquisition of other products.

## Actual results

| Source | Acquired input | Successful-transfer bytes | Input SHA256 |
|---|---|---:|---|
| CHIRPS v3 | 57 native AOI daily crops, consolidated final SAT series | 12,417,436 | `082e9b99e42e059eb78e0b5e7518478ab71b03a955f5f4f94227cbc1892358a2` |
| JRC GSW v1.5 | Native AOI occurrence crop, 1984–2024 | 335,872 | `b5821c7e6557be0f55065ced2a0761e5785506e95bcae3b5187027a0e050d3a5` |
| ESA WorldCover | Native 10 m AOI crop, 2021 v200 | 598,016 | `547109556bfc57a51de183585b33e4e09d27705229a198cf4ed06f663c907ead` |
| Copernicus DEM | Native AOI DSM mosaic from two GLO-30 tiles | 4,866,048 | `981d3165a15673f545a97b53f6dce62349c9d86c3c83d8d83c78e3f7a469f7eb` |
| IBGE | Three intersecting municipalities, mesh reference 2022 | 4,010,727 | `5b337aea6971a80098dcaf9d24787edcd691c338811e17bd3366da631110a9dc` |

Successful transfers total **22,228,099 bytes**, including TIFF range metadata and
the full RS municipal/name inventories used before AOI filtering. This is not the
sum of remote object sizes and excludes unsuccessful exploratory probes. All three
raster context summaries and all 57 rainfall crops reported full AOI coverage.

Immutable local acquisition packages are under
`data/context/acquired/vale-do-taquari/<source>/<id>/`. They retain native crops,
consolidated inputs and metadata; metadata contains retrieval and observation
periods, request bounds, product versions, source/terms links, units, attribution,
HTTP ETags, Last-Modified values, remote object lengths and SHA256 for every acquired
byte range. Individual CHIRPS crop hashes are retained alongside the series.
The existing importer copies the input into its independently verified immutable
`data/context/raw/` store. Neither acquisition crops nor remote full rasters are
included in browser publication. No raw acquisition data was added to Git.

| Source | Acquisition ID | Import ID |
|---|---|---|
| CHIRPS v3 | `2a45cbbae8c961efa2082512` | `a1f032b70bc25eed0396f649` |
| JRC GSW | `8431d813ef6fc27a30835527` | `8c185f41e8b9b6f0f04f94aa` |
| WorldCover | `6d80d048674a2aab7eeebe3c` | `d7f996784ef7a893b31af6dd` |
| Copernicus DEM | `a5b0ca808ee90a659515f299` | `037f269166e0293be6975d82` |
| IBGE | `ac4646b5695eff452e844e33` | `af88c43d25c0adaacf7d415f` |

## Source verification and interpretation

**CHIRPS v3 final SAT.** The [official product page](https://www.chc.ucsb.edu/data/chirps3)
provides the 0.05° land estimate and states both a public-domain waiver and a
CC BY 4.0 reference; metadata preserves both statements and the required data and
paper citations. The actual [2026 final SAT directory](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily/final/sat/2026/)
served the requested objects and listed products through October 31 on this run.
The filename includes `.sat.`, for example
`chirps-v3.0.sat.2026.07.23.tif`; omitting it returned 404.

The [official daily README](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily/readme.txt)
explains that SAT distributes pentadal totals using IMERG Late V07 timing. Date
labels follow UTC days, while contributing station observation periods can differ.
Therefore the report's new `daily_summaries` sums the previous complete 1, 2 and
3 **date labels** before each acquisition date. Existing exact acquisition-hour
`windows_mm` entries remain null. No daily amount is apportioned around a SAR
acquisition time, shifted to BRT or treated as independent station validation.
Missing labels remain null and measured zeros remain zero. Source daily TIFFs
observed here omit a GDAL nodata tag: negative/nonfinite precipitation is explicitly
masked as unavailable and the local crop uses a declared output sentinel of -9999.
This is a normalization policy, not an assertion that the source supplied that tag.

**JRC Global Surface Water.** The [official distribution and terms page](https://global-surface-water.appspot.com/download)
identifies the current v1.5 aggregate through 2024 and permits free use with
acknowledgement. It also documents the November 10 correction to occurrence values
and residual Collection 1/2 registration differences. The [official download instructions](https://global-surface-water.appspot.com/gsw/Download_Instructions.html)
identify the HTTPS CloudFerro GeoTIFF distribution; the actual object was
`occurrence_60W_20S_v1_5_2024.tif`, served as HTTP 206, remote length 61,731,755 bytes,
Last-Modified 2026-11-10. The 30 m nominal occurrence grid uses 0–100 percentages;
255 is nodata. The AOI mean historical frequency is about 0.03736, including genuine
zero-frequency cells. This is a long-term mean frequency, **not** 3.7% current
flooded area. No threshold or contemporary extent is derived; overlap area and
fraction stay null. Older v1.4 is not presented as the latest product.

**WorldCover.** The [official data and licence page](https://esa-worldcover.org/en/data-access)
supports public AWS COG access and CC BY 4.0 with the project/Sentinel attribution
retained in metadata. The actual native 10 m `S30W054` map object was HTTP 206,
remote length 112,823,893 bytes. The AOI crop contains the documented 2021 v200
classes. Its water/tree/cropland/built-up/other percentages describe 2021 surface
cover, not vegetation change or land cover measured on a 2026 SAR date.

**Copernicus DEM.** The [AWS public registry](https://registry.opendata.aws/copernicus-dem/)
identifies the credential-free GLO-30 Public COGs as the 2021 release. Both required
`S30_00_W053_00` and `S30_00_W052_00` objects served byte ranges. The [official
Copernicus product and user obligations](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM)
allow the public GLO-30 product with attribution; the required adapted-product
notice is retained verbatim in metadata. Primary observations are 2011–2015 with
older gap fills possible; release year is not acquisition year. The AOI has mean
DSM height about 46.79 m against EGM2008 and a derived mean surface slope about
5.03°. These values include vegetation and buildings, are not river gauge levels,
and do not establish safety, landslides or ground motion.

**IBGE.** The [official mesh API documentation](https://servicodados.ibge.gov.br/api/docs/malhas)
describes its simplified administrative geometry. The actual 2024 and 2023 period
requests returned HTTP 500; the explicitly requested **2022** period succeeded.
The full Rio Grande do Sul mesh was spatially filtered, with names joined from the
official locality inventory. The AOI intersects Cruzeiro do Sul (4306205), Estrela
(4307807) and Lajeado (4311403). No affected people, facilities or municipal impacts
are inferred. Provenance retains both response hashes and query parameters. Use
is attributed to IBGE under the federal public-data reuse basis in
[Decreto 8.777/2016](https://www.presidencia.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8777.htm),
article 4; no invented Creative Commons product licence is assigned.

Open-Meteo is optional and was not needed or enabled. ANA, IMERG/Earthdata and
MapBiomas/GEE remain optional import paths; their absence does not block these
public sources. No independent, temporally comparable reference product was
qualified by this acquisition; validation remains separate.

## Limits and checks

`context sources check` performs bounded HTTP accessibility probes; it does not
claim successful spatial normalization. `context sources fetch` crops and imports
serially. Requests permit registered HTTPS hosts only, reject redirects and
servers ignoring byte ranges, pin subsequent reads to ETags and reject changed
objects. Every byte read is charged to one cumulative budget. The raster opener
routes GDAL through the metered Python reader, avoiding untracked `/vsicurl`
transfers. Raster windows and merged grids are checked before decoding/allocation;
16 tiles, 366 requested days and 5,000 requests are hard outer limits. Explicit
pixel budget 2,000,000 was required for the native WorldCover crop. Spatial
summaries use equal-area exact pixel intersections in bounded vector batches.

Eight offline provider tests cover range hashes/ETags, pre-request budgets,
pre-decode pixel budgets, ignored ranges, source changes, actual opener crops,
provider failure isolation, JRC zero/nodata and daily-label semantics. The existing
context/core/spatial tests also pass with the vectorized intersection calculation.
Network results above are evidence for these exact dates and endpoints; they do
not guarantee future service availability or constitute scientific validation.
