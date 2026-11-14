from surfacesignal.domain import DataSource

SOURCES = [
    DataSource(
        source_id="nisar-gcov",
        name="NISAR L2 GCOV",
        organization="NASA / ISRO / ASF DAAC",
        url="https://nisar-docs.asf.alaska.edu/gcov/",
        use="Primary gamma0 backscatter observations",
        terms="Earthdata access terms and dataset citation apply. Provisional calibration/validation; no field accuracy inferred.",
    ),
    DataSource(
        source_id="asf-search",
        name="ASF Search",
        organization="ASF DAAC",
        url="https://nisar-docs.asf.alaska.edu/asf-search/",
        use="Scene discovery and provenance",
        terms="Public metadata; Earthdata Login required for HDF5 downloads.",
    ),
    DataSource(
        source_id="sgb-taquari",
        name="SACE Taquari",
        organization="Serviço Geológico do Brasil",
        url="https://sace.sgb.gov.br/bacia_taquari/",
        use="Regional hydrological context only",
        terms="Attribute SGB and specific dated bulletin. No blanket redistribution license asserted.",
    ),
    DataSource(
        source_id="opera-dswx-s1",
        name="OPERA DSWx-S1",
        organization="NASA JPL / PO.DAAC",
        url="https://www.jpl.nasa.gov/go/opera/products/dswx-product-suite/",
        use="Potential independent spatial comparison, not yet aligned",
        terms="Dataset-specific terms and quality flags apply; shares radar-related ambiguities.",
    ),
]
