"""Optional bounded offline-CLI metadata discovery; never downloads imagery."""

import hashlib
import json
import math
from datetime import UTC, datetime

import httpx

CEMS = "https://mapping.emergency.copernicus.eu/activations/api/activations/"
STAC = "https://stac.dataspace.copernicus.eu/v1/search"
COLLECTIONS = {"sentinel-1": "sentinel-1-grd", "sentinel-2": "sentinel-2-l2a"}


def discover(source_id, bbox, start, end, *, max_items=100, max_bytes=2_000_000, client=None):
    """Search one bounded STAC page, explicitly report incomplete inventories.

    Other providers remain blocked until a verified product/catalog export is supplied.
    No credentials or signed asset links are returned or persisted.
    """
    if len(bbox) != 4 or not all(math.isfinite(v) for v in bbox):
        raise ValueError("Finite bounding box required")
    if not (-180 <= bbox[0] < bbox[2] <= 180 and -90 <= bbox[1] < bbox[3] <= 90):
        raise ValueError("Invalid bounding box")
    times = [datetime.fromisoformat(v.replace("Z", "+00:00")) for v in (start, end)]
    if any(v.tzinfo is None for v in times) or times[0] > times[1]:
        raise ValueError("Ordered timezone-aware discovery interval required")
    if not 1 <= max_items <= 1000 or max_bytes < 1:
        raise ValueError("Invalid discovery budget")
    result = {
        "source_id": source_id,
        "status": "blocked",
        "items": [],
        "complete": False,
        "synthetic": False,
        "parameters": {
            "bbox": bbox,
            "start": start,
            "end": end,
            "max_items": max_items,
            "max_bytes": max_bytes,
        },
        "source_sha256": None,
        "limitations": ["Verified catalog access and product-specific license are required"],
    }
    if source_id not in COLLECTIONS and source_id != "copernicus-ems":
        if source_id not in {"rcm", "copernicus-ems", "opera-dswx-s1"}:
            raise ValueError("Unknown discovery source")
        return result
    request = {
        "collections": [COLLECTIONS.get(source_id)],
        "bbox": bbox,
        "datetime": start + "/" + end,
        "limit": max_items,
    }
    owned = client is None
    client = client or httpx.Client(timeout=30, follow_redirects=False)
    try:
        endpoint = CEMS if source_id == "copernicus-ems" else STAC
        kwargs = (
            {"params": {"limit": max_items}} if source_id == "copernicus-ems" else {"json": request}
        )
        with client.stream(
            "GET" if source_id == "copernicus-ems" else "POST", endpoint, **kwargs
        ) as response:
            response.raise_for_status()
            raw = bytearray()
            for chunk in response.iter_bytes():
                if len(raw) + len(chunk) > max_bytes:
                    raise ValueError("Discovery response byte budget exceeded")
                raw.extend(chunk)
        body = json.loads(raw)
        if source_id == "copernicus-ems":
            activations = body.get("results")
            if not isinstance(activations, list) or len(activations) > max_items:
                raise ValueError("Invalid activation inventory")
            items = []
            for activation in activations:
                instant = datetime.fromisoformat(
                    activation["activationTime"].replace("Z", "+00:00")
                )
                # Official CEMS documentation defines this timezone-free field as UTC.
                instant = instant.replace(tzinfo=UTC) if instant.tzinfo is None else instant
                if times[0] <= instant <= times[1]:
                    items.append(
                        {
                            "reference_id": activation["code"],
                            "observed_at": instant.isoformat(),
                            "spatial_coverage": "not_checked",
                            "redistribution_allowed": False,
                        }
                    )
            return {
                **result,
                "status": "partial" if items else "not_checked",
                "items": items,
                "source_sha256": hashlib.sha256(raw).hexdigest(),
                "source_url": CEMS,
                "complete": not bool(body.get("next")),
                "limitations": [
                    "Activation discovery only; centroid does not establish AOI coverage. Product footprints, acquisition dates and quality require separate qualification."
                ],
            }
        features = body.get("features")
        if not isinstance(features, list) or len(features) > max_items:
            raise ValueError("Invalid or oversized discovery inventory")
        items = []
        for feature in features:
            props = feature.get("properties", {})
            identifier, observed = feature.get("id"), props.get("datetime")
            if not isinstance(identifier, str) or not isinstance(observed, str):
                raise ValueError("Discovery item missing identity or acquisition time")
            items.append(
                {
                    "scene_id": identifier,
                    "observed_at": observed,
                    "collection": feature.get("collection"),
                    "cloud_cover_percent": props.get("eo:cloud_cover"),
                    "license_id": props.get("license"),
                    "redistribution_allowed": False,
                }
            )
        return {
            **result,
            "status": "available" if items else "unavailable",
            "items": items,
            "complete": not any(link.get("rel") == "next" for link in body.get("links", [])),
            "source_sha256": hashlib.sha256(raw).hexdigest(),
            "source_url": STAC,
            "limitations": [
                "Discovery only; access, QA, coverage and license need product-specific review; sensors are not numerically interchangeable"
            ],
        }
    except (httpx.HTTPError, json.JSONDecodeError):
        return {
            **result,
            "status": "unavailable",
            "limitations": ["Catalog request failed; no availability conclusion"],
        }
    finally:
        if owned:
            client.close()
