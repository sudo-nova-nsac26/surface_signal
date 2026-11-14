"""ASF catalog adapter. Public metadata; Earthdata authentication only for file access."""

import math
import os
import shutil
import time
from pathlib import Path
from urllib.parse import urlparse

import asf_search
import requests

from surfacesignal.domain import Scene
from surfacesignal.storage import checksum, read_json, safe_id, write_json


class ProviderError(RuntimeError):
    pass


class TimeoutSession(asf_search.ASFSession):
    def request(self, method, url, **kwargs):
        kwargs.setdefault("timeout", (15, 60))
        return super().request(method, url, **kwargs)


def map_feature(feature: dict, area_id: str, maturity: str | None = None) -> Scene:
    p = feature["properties"]
    name = p["sceneName"]
    parts = name.split("_")
    is_nisar = len(parts) >= 16 and parts[0] == "NISAR" and parts[3] == "GCOV"
    sizes = p.get("bytes")
    size = sizes.get(name + ".h5", {}).get("bytes") if isinstance(sizes, dict) else sizes
    return Scene(
        scene_id=name,
        area_id=area_id,
        start_time=p["startTime"],
        track=p.get("pathNumber"),
        frame=p.get("frameNumber"),
        direction=p.get("flightDirection"),
        mode=parts[8] if is_nisar else None,
        polarization=parts[9] if is_nisar else None,
        release=p.get("crid") or (parts[13] if is_nisar else None),
        maturity=p.get("dataMaturity") or maturity,
        url=p.get("url"),
        size_bytes=int(size) if size else None,
        geometry=feature.get("geometry"),
        metadata={
            "catalog_properties": p,
            "maturity_basis": "catalog"
            if p.get("dataMaturity")
            else "query_filter"
            if maturity
            else "unknown",
        },
    )


def search(
    wkt: str,
    start: str,
    end: str,
    area_id: str,
    *,
    short_name: str | None = None,
    generator=None,
    sleep=time.sleep,
    limit=10000,
) -> list[Scene]:
    generator = generator or asf_search.search_generator
    filters = (
        {"shortName": short_name}
        if short_name
        else {"dataset": "NISAR", "processingLevel": "GCOV", "dataMaturity": "PROVISIONAL"}
    )
    maturity = "VALIDATED" if short_name == "NISAR_L2_GCOV_V1" else "PROVISIONAL"
    collection = short_name or "NISAR_L2_GCOV_PROVISIONAL_V1"
    for attempt in range(3):
        try:
            scenes = {}
            for page in generator(
                **filters,
                intersectsWith=wkt,
                start=start,
                end=end,
                session=TimeoutSession(),
            ):
                for feature in page.geojson()["features"]:
                    scene = map_feature(feature, area_id, maturity)
                    scene.metadata["collection"] = collection
                    scenes[scene.scene_id] = scene
                    if len(scenes) > limit:
                        raise ProviderError(
                            "Catalog safety limit exceeded; narrow dates or AOI. No partial catalog saved."
                        )
            return sorted(scenes.values(), key=lambda s: (s.start_time, s.scene_id))
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (401, 403):
                raise ProviderError(f"ASF authorization error ({status})") from None
            if status not in (429, 500, 502, 503, 504) or attempt == 2:
                raise ProviderError(f"ASF HTTP failure ({status})") from None
        except (requests.Timeout, requests.ConnectionError):
            if attempt == 2:
                raise ProviderError(
                    "ASF unavailable after 3 attempts (timeout/connection)"
                ) from None
        sleep(2**attempt)
    raise ProviderError("ASF unavailable")


def download(scene: Scene, directory: Path, max_gb: float, *, session=None) -> Path:
    if not math.isfinite(max_gb) or max_gb <= 0:
        raise ValueError("Download budget must be finite and positive")
    if scene.size_bytes is None:
        raise ValueError("Catalog file size is unknown; refresh metadata before download")
    url = urlparse(scene.url or "")
    if (
        url.scheme != "https"
        or url.hostname != "nisar.asf.earthdatacloud.nasa.gov"
        or url.username
        or url.query
    ):
        raise ValueError("Download host must be the official NISAR ASF archive")
    if max_gb <= 0 or scene.size_bytes > max_gb * 1_000_000_000:
        raise ValueError("Scene exceeds maximum download budget")
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / (safe_id(scene.scene_id) + ".h5")
    receipt = target.with_suffix(".receipt.json")
    if target.exists():
        if (
            receipt.exists()
            and target.stat().st_size == scene.size_bytes
            and checksum(target) == read_json(receipt)["sha256"]
        ):
            return target
        raise ValueError(
            "Existing file lacks valid receipt/checksum; move it aside before retrying"
        )
    if shutil.disk_usage(directory).free < scene.size_bytes + 512 * 1024 * 1024:
        raise ValueError("Insufficient disk space with 512 MiB reserve")
    session = session or TimeoutSession()
    token = os.getenv("EARTHDATA_TOKEN")
    if token:
        try:
            session.auth_with_token(token)
        except Exception:
            raise ProviderError("Earthdata token authentication failed") from None
    part = target.with_suffix(".h5.part")
    try:
        with session.get(scene.url, stream=True, timeout=(15, 60)) as response:
            response.raise_for_status()
            declared = response.headers.get("Content-Length")
            if declared and int(declared) != scene.size_bytes:
                raise ValueError("Remote Content-Length differs from catalog size")
            count = 0
            with part.open("wb") as file:
                for chunk in response.iter_content(1024 * 1024):
                    count += len(chunk)
                    if count > scene.size_bytes:
                        raise ValueError("Download exceeds expected size")
                    file.write(chunk)
            if count != scene.size_bytes:
                raise ValueError("Incomplete download")
        import h5py

        if not h5py.is_hdf5(part):
            raise ValueError("Response is not HDF5 (possible authentication page)")
        digest = checksum(part)
        os.replace(part, target)
        write_json(
            receipt,
            {
                "scene_id": scene.scene_id,
                "size_bytes": count,
                "sha256": digest,
                "source_url": scene.url,
                "integrity": "local SHA256 and size; provider checksum unavailable",
            },
        )
        return target
    except requests.RequestException:
        raise ProviderError(
            "Earthdata download failed; configure official .netrc or EARTHDATA_TOKEN locally"
        ) from None
    finally:
        part.unlink(missing_ok=True)
