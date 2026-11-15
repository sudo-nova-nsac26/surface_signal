"""Environmental inventory: import readiness is distinct from acquired observations."""

_ROWS = [
    (
        "ana-hidroweb",
        "ANA HidroWeb",
        "https://www.snirh.gov.br/hidroweb/acesso-api",
        "environmental_context",
        "import_ready",
    ),
    (
        "sgb-taquari",
        "SGB SACE Taquari",
        "https://sace.sgb.gov.br/bacia_taquari/",
        "environmental_context",
        "import_ready",
    ),
    (
        "gpm-imerg",
        "NASA GPM IMERG V07",
        "https://gpm.nasa.gov/data/imerg",
        "environmental_context",
        "import_ready",
    ),
    (
        "mapbiomas-water",
        "MapBiomas Água Coleção 5",
        "https://brasil.mapbiomas.org/downloads/assets-no-google-earth-engine/",
        "historical_context",
        "import_ready",
    ),
    (
        "worldcover",
        "ESA WorldCover 2021 v200",
        "https://esa-worldcover.org/en/data-access",
        "historical_context",
        "import_ready",
    ),
    (
        "ibge",
        "IBGE municipal boundaries",
        "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3",
        "environmental_context",
        "import_ready",
    ),
    (
        "copernicus-dem",
        "Copernicus DEM GLO-30 DSM",
        "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
        "environmental_context",
        "import_ready",
    ),
    (
        "copernicus-ems",
        "Copernicus EMS",
        "https://mapping.emergency.copernicus.eu/about/how-to-harvest-cems-mapping-data/",
        "independent_reference",
        "discovery_only",
    ),
    (
        "opera-dswx-s1",
        "NASA OPERA DSWx-S1",
        "https://www.jpl.nasa.gov/go/opera/products/dswx-product-suite/",
        "environmental_context",
        "discovery_only",
    ),
    (
        "sentinel-1",
        "Copernicus Sentinel-1",
        "https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
        "sensor_observation",
        "discovery_only",
    ),
    (
        "sentinel-2",
        "Copernicus Sentinel-2",
        "https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
        "sensor_observation",
        "discovery_only",
    ),
    (
        "rcm",
        "RADARSAT Constellation Mission",
        "https://donnees-data.asc-csa.gc.ca/en/dataset/rcm",
        "sensor_observation",
        "blocked",
    ),
]


def context_sources():
    from surfacesignal.providers.public_sources import CATALOG

    registered = [
        {
            "source_id": sid,
            "name": name,
            "url": url,
            "role": role,
            "integration_status": status,
            "terms_url": url,
            "coverage_period": "1985–2025"
            if sid == "mapbiomas-water"
            else "2021"
            if sid == "worldcover"
            else None,
            "redistribution_allowed": False,
            "limitations": [
                "Registration does not establish observations for this analysis; product-specific terms must be verified"
            ],
            "update_note": "Local imports only; authenticated services are never accessed by HTTP request handlers",
        }
        for sid, name, url, role, status in _ROWS
    ]

    for sid, catalog in CATALOG.items():
        row = next((item for item in registered if item["source_id"] == sid), None)
        values = {
            "source_id": sid,
            "name": catalog["dataset_id"],
            "url": catalog["source_url"],
            "role": "historical_context"
            if sid in {"jrc-gsw", "worldcover"}
            else "environmental_context",
            "integration_status": "import_ready",
            "terms_url": catalog["terms_url"],
            "coverage_period": catalog["coverage_period"],
            "redistribution_allowed": True,
            "limitations": catalog["limitations"]
            + ["Registration is not evidence of observations; run offline sources check/fetch."],
            "update_note": "Credential-free bounded offline acquisition only; never fetched by GET requests.",
        }
        if row is None:
            registered.append(values)
        else:
            row.update(values)
    return registered
