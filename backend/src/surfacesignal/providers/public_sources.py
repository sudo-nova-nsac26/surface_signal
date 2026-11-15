"""Credential-free, bounded offline acquisition of documented public products.

Registration, network accessibility and successful local import are separate states.
CHIRPS daily labels are never substituted for exact acquisition-hour windows.
"""

import hashlib
import json
import math
import os
import shutil
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import geometry_window
from rasterio.io import MemoryFile
from rasterio.merge import merge
from shapely.geometry import box, mapping, shape

from surfacesignal.api.service import Repository
from surfacesignal.context.importer import digest, import_dataset
from surfacesignal.context.models import ContextBudgets
from surfacesignal.context.spatial import raster_summary
from surfacesignal.preparation.context import safe_path
from surfacesignal.providers.public_http import (
    DownloadBudget,
    PublicRangeReader,
    get_bytes,
    public_client,
)
from surfacesignal.storage import checksum, read_json, safe_id, write_json

PUBLIC_IDS = ("chirps-v3", "jrc-gsw", "worldcover", "copernicus-dem", "ibge")
CATALOG = {
    "chirps-v3": {
        "provider": "UCSB Climate Hazards Center",
        "dataset_id": "CHIRPS v3 daily final SAT",
        "dataset_version": "3.0",
        "source_url": "https://www.chc.ucsb.edu/data/chirps3",
        "terms_url": "https://www.chc.ucsb.edu/data/chirps3",
        "license_id": "CC-BY-4.0 / public-domain waiver (both stated by CHC)",
        "spatial_resolution_m": 5566,
        "coverage_period": "1981–near present; actual daily objects checked",
        "limitations": [
            "Daily estimates disaggregate pentadal totals using IMERG Late V07; not independent daily station observations.",
            "UTC calendar-day labels do not establish uniform UTC observation windows for contributing stations.",
            "Regional 0.05 degree estimate; not rainfall at SAR pixel resolution.",
        ],
        "attribution": "CHIRPS3, UCSB Climate Hazards Center, doi:10.15780/G2JQ0P; Funk et al. (2026), doi:10.1038/s41597-026-07096-4",
    },
    "jrc-gsw": {
        "provider": "EC JRC / Google",
        "dataset_id": "JRC Global Surface Water occurrence 1984–2024",
        "dataset_version": "1.5",
        "source_url": "https://global-surface-water.appspot.com/download",
        "terms_url": "https://global-surface-water.appspot.com/download",
        "license_id": "Copernicus free and open use with acknowledgement",
        "spatial_resolution_m": 30,
        "coverage_period": "1984–2024 historical aggregate",
        "limitations": [
            "Historical water occurrence percentage; not water observed on the SAR date or flood confirmation.",
            "v1.5 combines Landsat Collections 1 and 2; residual spatial offsets may reach a pixel.",
            "Zero is a valid occurrence percentage; nodata=255 remains unavailable.",
        ],
        "attribution": "Source: EC JRC/Google; Pekel et al. (2016), Nature 540, 418–422, doi:10.1038/nature20584",
    },
    "worldcover": {
        "provider": "ESA WorldCover consortium",
        "dataset_id": "ESA WorldCover 2021 v200",
        "dataset_version": "v200",
        "source_url": "https://esa-worldcover.org/en/data-access",
        "terms_url": "https://esa-worldcover.org/en/data-access",
        "license_id": "CC-BY-4.0",
        "spatial_resolution_m": 10,
        "coverage_period": "2021 historical map",
        "limitations": ["Static 2021 land cover; not vegetation change monitoring in 2026."],
        "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
    },
    "copernicus-dem": {
        "provider": "Copernicus / DLR / Airbus via AWS Open Data",
        "dataset_id": "Copernicus DEM GLO-30 Public DSM, 2021 release",
        "dataset_version": "2021",
        "source_url": "https://registry.opendata.aws/copernicus-dem/",
        "terms_url": "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
        "license_id": "Copernicus DEM GLO-30 Public free licence with attribution",
        "spatial_resolution_m": 30,
        "coverage_period": "2011–2015 primary acquisition; older gap fills possible; 2021 release",
        "limitations": [
            "DSM includes buildings and vegetation; not bare ground, water level, InSAR movement or safety."
        ],
        "attribution": "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved",
    },
    "ibge": {
        "provider": "IBGE",
        "dataset_id": "IBGE simplified municipal mesh 2022",
        "dataset_version": "API v3 / 2022",
        "source_url": "https://servicodados.ibge.gov.br/api/docs/malhas",
        "terms_url": "https://www.ibge.gov.br/acesso-informacao/institucional.html",
        "license_id": "IBGE public data; attribution / Decreto 8777/2016 art.4",
        "spatial_resolution_m": None,
        "coverage_period": "2022 administrative reference",
        "limitations": [
            "Simplified administrative geometry; intersections are not confirmed impacts or population counts."
        ],
        "attribution": "Source: IBGE, municipal mesh 2022, API de malhas v3; administrative context only.",
    },
}


def _time(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value is None or value.tzinfo is None:
        raise ValueError("Timezone-aware public source interval required")
    return value.astimezone(UTC)


def _request(settings, area_id, source_ids, start, end, max_pixels):
    if isinstance(max_pixels, bool) or not 1 <= max_pixels <= 4_000_000:
        raise ValueError("Public source pixel budget must be 1..4000000")
    repo = Repository(settings)
    area = repo.area(area_id)
    geometry = shape(area.geometry)
    if not geometry.is_valid or geometry.is_empty:
        raise ValueError("Valid AOI geometry required")
    ids = list(PUBLIC_IDS if source_ids is None else source_ids)
    if not ids or any(s not in PUBLIC_IDS for s in ids) or len(set(ids)) != len(ids):
        raise ValueError("Unknown or duplicate public source ID")
    scenes = [s for s in repo.scenes() if s.area_id == area_id and not s.synthetic]
    if not scenes:
        # A clean clone has the real versioned ASF metadata, not data/catalog.
        from surfacesignal.domain import CatalogSnapshot

        snapshot = settings.root / "docs/evidence/asf-catalog.json"
        if snapshot.is_file():
            scenes = [
                s
                for s in CatalogSnapshot.model_validate(read_json(safe_path(snapshot))).scenes
                if s.area_id == area_id and not s.synthetic
            ]
    start = _time(start) if start else min((s.start_time for s in scenes), default=None)
    end = _time(end) if end else max((s.start_time for s in scenes), default=None)
    if start is None or end is None or start > end:
        raise ValueError("Ordered interval or real scene catalog required")
    if (end - start).days > 366:
        raise ValueError("Public acquisition interval exceeds 366-day budget")
    acquisitions = sorted({s.start_time for s in scenes if start <= s.start_time <= end})
    if not acquisitions:
        acquisitions = sorted({start, end})
    days = sorted(
        {instant.date() - timedelta(days=n) for instant in acquisitions for n in (1, 2, 3)}
    )
    return area, ids, start, end, days


def _tile_urls(source, bounds):
    west, south, east, north = bounds
    step = {"worldcover": 3, "copernicus-dem": 1, "jrc-gsw": 10}[source]
    cells = [
        (x, y)
        for x in range(math.floor(west / step) * step, math.ceil(east / step) * step, step)
        for y in range(math.floor(south / step) * step, math.ceil(north / step) * step, step)
    ]
    if len(cells) > 16:
        raise ValueError("AOI requires more than 16 tiles; spatial budget exceeded")
    urls = []
    for x, y in cells:
        ew, ns = "E" if x >= 0 else "W", "N" if y >= 0 else "S"
        if source == "worldcover":
            tile = f"{ns}{abs(y):02d}{ew}{abs(x):03d}"
            url = f"https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
        elif source == "copernicus-dem":
            tile = f"Copernicus_DSM_COG_10_{ns}{abs(y):02d}_00_{ew}{abs(x):03d}_00_DEM"
            url = f"https://copernicus-dem-30m.s3.amazonaws.com/{tile}/{tile}.tif"
        else:
            top = y + step
            tile = f"{abs(x)}{ew}_{abs(top)}{'N' if top >= 0 else 'S'}"
            url = f"https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water/download2024/Aggregated/VER1-5/occurrence/occurrence_{tile}_v1_5_2024.tif"
        urls.append(url)
    return urls


def _rain_url(day):
    return f"https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily/final/sat/{day.year}/chirps-v3.0.sat.{day:%Y.%m.%d}.tif"


def _crop(url, geometry, client, budget, max_pixels, *, source):
    reader = PublicRangeReader(client, url, budget)

    def opener(path, mode="rb"):
        if path != "source.tif":
            raise FileNotFoundError(path)
        reader.seek(0)
        return reader

    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_CACHEMAX=16):
        with rasterio.open("source.tif", opener=opener) as src:
            if src.crs is None or src.crs.to_epsg() != 4326 or src.count != 1:
                raise ValueError("Expected single-band EPSG:4326 public raster")
            intersection = shape(geometry).intersection(box(*src.bounds))
            if intersection.is_empty:
                raise ValueError("Public tile does not overlap requested AOI")
            window = geometry_window(src, [mapping(intersection)])
            if window.width * window.height > max_pixels:
                raise ValueError("Public raster crop pixel budget exceeded before read")
            dtype = np.dtype(src.dtypes[0])
            if window.width * window.height * dtype.itemsize > 64_000_000:
                raise ValueError("Public raster decoded memory budget exceeded before read")
            nodata = src.nodata
            if nodata is None:
                nodata = (
                    255 if source == "jrc-gsw" else -32767 if source == "copernicus-dem" else None
                )
            if nodata is None and source == "chirps-v3":
                # CHC daily TIFFs omit a GDAL nodata tag. Output sentinel is ours;
                # reject negative/nonfinite precipitation, never convert it to zero.
                nodata = -9999
            if nodata is None:
                raise ValueError("Public raster has no documented nodata")
            masked = src.read(1, window=window, masked=True)
            if source == "chirps-v3":
                masked = np.ma.masked_where(~np.isfinite(masked.data) | (masked.data < 0), masked)
            data = masked.filled(nodata)
            profile = dict(
                driver="GTiff",
                width=data.shape[1],
                height=data.shape[0],
                count=1,
                dtype=str(dtype),
                crs=src.crs,
                transform=src.window_transform(window),
                nodata=nodata,
                compress="deflate",
            )
            evidence = reader.evidence()
    return data, profile, evidence


def _raster_file(source, urls, area, file, client, budget, max_pixels):
    memory, datasets, evidence = [], [], []
    try:
        for url in urls:
            data, profile, proof = _crop(
                url, area.geometry, client, budget, max_pixels, source=source
            )
            mem = MemoryFile()
            with mem.open(**profile) as dst:
                dst.write(data, 1)
            memory.append(mem)
            datasets.append(mem.open())
            evidence.append(proof)
        # Bound the assembled grid before merge allocates, including multi-tile seams.
        resx, resy = datasets[0].res
        west = min(d.bounds.left for d in datasets)
        east = max(d.bounds.right for d in datasets)
        south = min(d.bounds.bottom for d in datasets)
        north = max(d.bounds.top for d in datasets)
        if math.ceil((east - west) / resx) * math.ceil((north - south) / resy) > max_pixels:
            raise ValueError("Merged public raster pixel budget exceeded before allocation")
        data, transform = merge(datasets)
        profile = datasets[0].profile.copy()
        profile.update(width=data.shape[2], height=data.shape[1], transform=transform)
        with rasterio.open(file, "w", **profile) as dst:
            dst.write(data)
    finally:
        for dataset in datasets:
            dataset.close()
        for mem in memory:
            mem.close()
    return evidence


def _ibge(area, file, client, budget):
    # A complete RS inventory is filtered geometrically; no inferred municipal names.
    if not box(-58, -34, -49, -27).covers(shape(area.geometry)):
        raise ValueError("IBGE public collector currently supports Rio Grande do Sul AOIs only")
    requests = [
        (
            "https://servicodados.ibge.gov.br/api/v3/malhas/estados/43",
            {
                "periodo": "2022",
                "intrarregiao": "municipio",
                "qualidade": "maxima",
                "formato": "application/vnd.geo+json",
            },
        ),
        ("https://servicodados.ibge.gov.br/api/v1/localidades/estados/43/municipios", None),
    ]
    bodies, evidence = [], []
    for url, params in requests:
        raw, headers, status = get_bytes(client, url, budget, limit=8_000_000, params=params)
        bodies.append(json.loads(raw))
        evidence.append(
            {
                "url": url,
                "query_parameters": params,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "response_bytes": len(raw),
                "http_status": status,
                "last_modified": headers.get("last-modified"),
            }
        )
    names = {str(item["id"]): item["nome"] for item in bodies[1]}
    features = []
    geom = shape(area.geometry)
    for feature in bodies[0]["features"]:
        code = str(feature["properties"]["codarea"])
        if shape(feature["geometry"]).intersects(geom):
            if code not in names:
                raise ValueError("Municipality name unavailable from official locality inventory")
            features.append({**feature, "properties": {"codarea": code, "nome": names[code]}})
    if not features:
        raise ValueError("No municipal polygons overlap AOI")
    write_json(file, {"type": "FeatureCollection", "features": features})
    return evidence


def _metadata(source, file, evidence, area, start, end):
    catalog = CATALOG[source]
    parameters = {
        "bbox": list(shape(area.geometry).bounds),
        "terms_url": catalog["terms_url"],
        "attribution": catalog["attribution"],
        "acquisition": evidence,
        "requested_interval": [start.isoformat(), end.isoformat()],
    }
    unit = "class"
    if source == "jrc-gsw":
        observed_start, observed_end = "1984-03-16T00:00:00Z", "2025-01-01T00:00:00Z"
        parameters.update(reference_year=2024, product_kind="occurrence", frequency_scale=100)
        unit = "%"
    elif source == "worldcover":
        observed_start, observed_end = "2021-01-01T00:00:00Z", "2022-01-01T00:00:00Z"
        parameters.update(reference_year=2021)
    elif source == "copernicus-dem":
        observed_start, observed_end = "2011-01-01T00:00:00Z", "2016-01-01T00:00:00Z"
        parameters.update(
            reference_year=2021,
            vertical_datum="EGM2008",
            observation_period_note="Primary TanDEM-X acquisition period; older infill may exist.",
        )
        unit = "m"
    elif source == "ibge":
        observed_start, observed_end = "2022-01-01T00:00:00Z", "2023-01-01T00:00:00Z"
        parameters.update(reference_year=2022, administrative_reference=True)
        unit = "geometry"
    else:
        records = read_json(file)["records"]
        observed_start, observed_end = records[0]["start"], records[-1]["end"]
        parameters.update(
            run="final",
            disaggregation="sat / IMERG Late V07",
            spatial_support="AOI equal-area-weighted native 0.05 degree cells",
            temporal_semantics="UTC calendar-day labels; mixed station observation windows",
            daily_label_totals_only=True,
            output_nodata=-9999,
            nodata_policy="Source TIFF may omit nodata tag; negative or nonfinite rainfall is unavailable, never zero",
        )
        unit = "mm"
    return {
        "source_id": source,
        "provider": catalog["provider"],
        "dataset_id": catalog["dataset_id"],
        "dataset_version": catalog["dataset_version"],
        "retrieved_at": datetime.now(UTC).isoformat(),
        "observed_start": observed_start,
        "observed_end": observed_end,
        "source_url": catalog["source_url"],
        "source_sha256": checksum(file),
        "crs": "EPSG:4326",
        "spatial_resolution_m": catalog["spatial_resolution_m"],
        "temporal_resolution_seconds": 86400 if source == "chirps-v3" else None,
        "native_unit": unit,
        "normalized_unit": unit,
        "license_id": catalog["license_id"],
        "redistribution_allowed": True,
        "synthetic": False,
        "quality_flags": ["historical_context_only"]
        if source in {"jrc-gsw", "worldcover", "copernicus-dem", "ibge"}
        else ["daily_disaggregated_estimate"],
        "limitations": catalog["limitations"],
        "parameters": parameters,
    }


def _run(
    settings,
    area_id,
    *,
    source_ids=None,
    start=None,
    end=None,
    max_download_bytes=25_000_000,
    max_pixels=1_000_000,
    client=None,
    fetch=False,
    dry_run=False,
    budgets=None,
):
    area, ids, start, end, days = _request(settings, area_id, source_ids, start, end, max_pixels)
    budget = DownloadBudget(max_download_bytes)
    owned = client is None
    client = client or public_client()
    budgets = budgets or ContextBudgets(max_pixels=max_pixels)
    results = []
    try:
        for source in ids:
            result = {
                "source_id": source,
                "status": "unavailable",
                "synthetic": False,
                "credentials_required": False,
                "requested_start": start.isoformat(),
                "requested_end": end.isoformat(),
                "terms_url": CATALOG[source]["terms_url"],
                "coverage_period": CATALOG[source]["coverage_period"],
                "limitations": CATALOG[source]["limitations"],
                "downloaded_bytes": 0,
            }
            previous = budget.used
            try:
                urls = (
                    [_rain_url(day) for day in days]
                    if source == "chirps-v3"
                    else _tile_urls(source, shape(area.geometry).bounds)
                    if source != "ibge"
                    else []
                )
                if not fetch or dry_run:
                    evidence = []
                    if source == "ibge":
                        raw, _, status = get_bytes(
                            client,
                            "https://servicodados.ibge.gov.br/api/v1/localidades/estados/43/municipios",
                            budget,
                            limit=2_000_000,
                        )
                        evidence = [
                            {"http_status": status, "sha256": hashlib.sha256(raw).hexdigest()}
                        ]
                    else:
                        for url in urls:
                            reader = PublicRangeReader(client, url, budget)
                            evidence.append(reader.evidence())
                            reader.close()
                    result.update(
                        status="accessible",
                        product_objects=len(evidence),
                        evidence=evidence,
                        dry_run=dry_run,
                        imported=False,
                    )
                    result["limitations"] = result["limitations"] + [
                        "HTTP accessibility check only; spatial validity and normalized import require fetch."
                    ]
                else:
                    base = safe_path(
                        settings.root / "data/context/acquired" / safe_id(area_id) / source
                    )
                    base.mkdir(parents=True, exist_ok=True)
                    staging = Path(tempfile.mkdtemp(prefix=".fetch-", dir=base))
                    try:
                        file = staging / (
                            "input.json" if source in {"chirps-v3", "ibge"} else "input.tif"
                        )
                        if source == "ibge":
                            evidence = _ibge(area, file, client, budget)
                        elif source == "chirps-v3":
                            records, evidence = [], []
                            for day, url in zip(days, urls, strict=True):
                                crop = staging / f"{day.isoformat()}.tif"
                                proofs = _raster_file(
                                    source, [url], area, crop, client, budget, max_pixels
                                )
                                summary = raster_summary(
                                    crop,
                                    area.geometry,
                                    "gpm-imerg",
                                    {"crs": "EPSG:4326"},
                                    max_pixels=max_pixels,
                                )
                                value = (
                                    summary.get("value")
                                    if summary.get("coverage_fraction", 0) >= 0.999
                                    else None
                                )
                                instant = datetime.combine(day, datetime.min.time(), UTC)
                                records.append(
                                    {
                                        "start": instant.isoformat(),
                                        "end": (instant + timedelta(days=1)).isoformat(),
                                        "value": value,
                                        "unit": "mm",
                                        "quality_status": "valid"
                                        if value is not None
                                        else "missing",
                                    }
                                )
                                evidence.append(
                                    {
                                        "date_label": day.isoformat(),
                                        "crop_sha256": checksum(crop),
                                        "crop_file": crop.name,
                                        "coverage_fraction": summary.get("coverage_fraction"),
                                        "objects": proofs,
                                    }
                                )
                            write_json(file, {"records": records})
                        else:
                            evidence = _raster_file(
                                source, urls, area, file, client, budget, max_pixels
                            )
                        metadata = _metadata(source, file, evidence, area, start, end)
                        identity = digest(
                            {k: v for k, v in metadata.items() if k != "retrieved_at"}
                        )[:24]
                        destination = base / identity
                        if destination.exists():
                            if checksum(destination / file.name) != checksum(file):
                                raise ValueError("Immutable public acquisition identity mismatch")
                        else:
                            write_json(staging / "metadata.json", metadata)
                            os.rename(staging, destination)
                        imported = import_dataset(
                            settings,
                            area_id,
                            source,
                            destination / file.name,
                            destination / "metadata.json",
                            budgets=budgets,
                        )
                        result.update(
                            status="imported",
                            imported=True,
                            **imported,
                            acquisition_id=identity,
                            source_sha256=checksum(destination / file.name),
                            objects=len(evidence),
                        )
                    finally:
                        if staging.exists():
                            shutil.rmtree(staging)
            except (ValueError, OSError, KeyError, TypeError, rasterio.errors.RasterioError) as exc:
                # Error strings are bounded and endpoints contain no credentials.
                result.update(status="unavailable", imported=False, reason=str(exc)[:500])
            except Exception as exc:
                # httpx transport/status failures are isolated to the selected provider.
                import httpx

                if not isinstance(exc, httpx.HTTPError):
                    raise
                result.update(
                    status="unavailable",
                    imported=False,
                    reason=f"{type(exc).__name__}: {str(exc)[:400]}",
                )
            result["downloaded_bytes"] = budget.used - previous
            results.append(result)
    finally:
        if owned:
            client.close()
    return {
        "area_id": area_id,
        "checked_at": datetime.now(UTC).isoformat(),
        "synthetic": False,
        "downloaded_bytes": budget.used,
        "max_download_bytes": budget.maximum,
        "max_pixels": max_pixels,
        "sources": results,
    }


def check_public_sources(settings, area_id, **kwargs):
    """Probe exact public objects without importing or reading complete rasters."""
    return _run(settings, area_id, **kwargs)


def fetch_public_sources(settings, area_id, **kwargs):
    """Acquire bounded AOI crops/series and import them serially, offline only."""
    return _run(settings, area_id, fetch=True, **kwargs)
