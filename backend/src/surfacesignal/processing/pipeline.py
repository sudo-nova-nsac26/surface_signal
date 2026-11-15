"""Offline SAR-analysis pipeline with atomic scientific artifacts.

Heavy processing must never run in request handlers. Derived vector exports and
previews are explanatory products: they do not independently identify flood damage.
Future: attach field/independent-sensor validation as a separate, auditable stage,
without rewriting historical manifests or treating heuristic scores as accuracy.
"""

import hashlib
import importlib.metadata
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image, ImageDraw
from rasterio.features import shapes
from rasterio.warp import transform_geom

from surfacesignal import __version__
from surfacesignal.domain import Analysis, Evidence, comparable
from surfacesignal.processing.change import compare
from surfacesignal.processing.gcov import crop, verify_scene
from surfacesignal.providers.hydro import context_for
from surfacesignal.storage import checksum, read_json, write_json

ARTIFACT_NAMES = {
    "before-preview.png",
    "after-preview.png",
    "delta-db.tif",
    "change-candidates.geojson",
    "statistics.json",
    "evidence.json",
    "manifest.json",
}


class ArtifactIntegrityError(ValueError):
    pass


def runtime_versions():
    return {
        p: importlib.metadata.version(p)
        for p in ("numpy", "rasterio", "h5py", "pyproj", "scipy", "pillow")
    }


def implementation_fingerprint():
    package = Path(__file__).resolve().parents[1]
    sources = {
        name: checksum(package / name)
        for name in (
            "domain.py",
            "processing/gcov.py",
            "processing/change.py",
            "processing/pipeline.py",
            "providers/hydro.py",
        )
    }
    return hashlib.sha256(json.dumps(sources, sort_keys=True).encode()).hexdigest()


def verify_artifacts(directory, *, manifest_sha256=None):
    directory = Path(directory)
    try:
        manifest = directory / "manifest.json"
        if directory.is_symlink() or manifest.is_symlink():
            raise ValueError("Symlinked analysis")
        if manifest_sha256 is not None and checksum(manifest) != manifest_sha256:
            raise ValueError("Manifest hash differs")
        analysis = Analysis.model_validate(read_json(manifest))
        if analysis.analysis_id != directory.name or set(analysis.artifacts) != ARTIFACT_NAMES - {
            "manifest.json"
        }:
            raise ValueError("Incomplete artifact inventory")
        if not all(
            (directory / name).is_file()
            and not (directory / name).is_symlink()
            and checksum(directory / name) == sha
            for name, sha in analysis.artifacts.items()
        ):
            raise ValueError("Artifact hash differs")
        if analysis.statistics != read_json(
            directory / "statistics.json"
        ) or analysis.evidence.model_dump(mode="json") != read_json(directory / "evidence.json"):
            raise ValueError("Manifest statistics/evidence differ from artifacts")
        if (
            any(
                s.synthetic != analysis.synthetic or s.area_id != analysis.area_id
                for s in analysis.scenes
            )
            or analysis.evidence.synthetic != analysis.synthetic
            or analysis.evidence.provenance != analysis.provenance
        ):
            raise ValueError("Manifest provenance fields disagree")
        return analysis
    except (OSError, ValueError, KeyError, TypeError):
        raise ArtifactIntegrityError(
            "Existing analysis failed integrity check; preserve the damaged directory outside artifacts and rerun"
        ) from None


def preview(array, path, synthetic):
    normalized = np.clip((np.nan_to_num(array, nan=-30) + 30) / 35, 0, 1)
    rgb = np.repeat((normalized[..., None] * 255).astype("uint8"), 3, axis=2)
    rgb[~np.isfinite(array)] = [30, 40, 60]
    image = Image.fromarray(rgb)
    image.thumbnail((1200, 1200))
    # Fixed scale, labelled outside data: previews are not classified flood maps.
    canvas = Image.new("RGB", (max(420, image.width), image.height + 38), "white")
    canvas.paste(image, (0, 38))
    ImageDraw.Draw(canvas).text(
        (8, 8),
        ("SYNTHETIC TEST | " if synthetic else "NISAR | ") + "gamma0 dB: -30 (black) to +5 (white)",
        fill="black",
    )
    canvas.save(path, format="PNG")


def run_analysis(
    before_path,
    after_path,
    before_scene,
    after_scene,
    area,
    output_dir,
    *,
    frequency="A",
    channel="HHHH",
    delta_threshold=-3.0,
    water_threshold=-17.0,
    min_component_pixels=9,
    edge_pixels=1,
    min_looks=1.0,
    hydro_records=None,
    verified_input_sha256=None,
):
    if not comparable(before_scene, after_scene):
        raise ValueError(
            "Scenes require ordered times and identical known track/frame/direction/mode/polarization/release/area"
        )
    if before_scene.area_id != area.area_id or before_scene.synthetic != after_scene.synthetic:
        raise ValueError("Area or synthetic provenance mismatch")
    verify_scene(before_path, before_scene)
    verify_scene(after_path, after_scene)
    parameters = dict(
        frequency=frequency,
        channel=channel,
        delta_threshold=delta_threshold,
        water_threshold=water_threshold,
        min_component_pixels=min_component_pixels,
        edge_pixels=edge_pixels,
        min_looks=min_looks,
    )
    versions = runtime_versions()
    # History already checks every raw file against its receipt once per execution.
    # Standalone analyze continues to hash its own inputs.
    input_hashes = (
        verified_input_sha256
        if verified_input_sha256 is not None
        else [checksum(before_path), checksum(after_path)]
    )
    if len(input_hashes) != 2 or not all(
        isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest) for digest in input_hashes
    ):
        raise ValueError("Two verified SHA256 input hashes required")
    context = context_for(hydro_records or [], after_scene.start_time)
    provenance = {
        "algorithm": "open-water-change-v2",
        "package_version": __version__,
        "versions": versions,
        "implementation_sha256": implementation_fingerprint(),
        "input_sha256": list(input_hashes),
        "area": area.model_dump(mode="json"),
        "hydrological_context": context,
    }
    identity = {
        "parameters": parameters,
        "provenance": provenance,
        "scenes": [s.model_dump(mode="json") for s in (before_scene, after_scene)],
    }
    identifier = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:24]
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / identifier
    if target.exists():
        previous = verify_artifacts(target)
        if (
            previous.parameters == parameters
            and previous.scenes == [before_scene, after_scene]
            and all(previous.provenance.get(key) == value for key, value in provenance.items())
        ):
            return previous
        raise ArtifactIntegrityError(
            "Existing analysis identity failed integrity check; preserve the damaged directory outside artifacts and rerun"
        )
    b = crop(before_path, area, frequency=frequency, channel=channel, min_looks=min_looks)
    a = crop(after_path, area, frequency=frequency, channel=channel, min_looks=min_looks)
    result = compare(
        b,
        a,
        delta_threshold=delta_threshold,
        water_threshold=water_threshold,
        min_component_pixels=min_component_pixels,
        edge_pixels=edge_pixels,
    )
    provenance.update(
        {"alignment": result["alignment"], "before_grid": b.metadata, "after_grid": a.metadata}
    )
    synthetic = before_scene.synthetic
    source_urls = [] if synthetic else [s.url for s in (before_scene, after_scene) if s.url]
    source_urls += [r["source_url"] for r in context]
    evidence = Evidence(
        observation=f"{'Synthetic test: ' if synthetic else ''}{result['statistics']['valid_pixels']} valid pixels compared; mean backscatter change {result['statistics']['mean_delta_db']:.4f} dB.",
        interpretation="Pixels meeting both decrease and low-return thresholds are exploratory open-water change candidates. This does not establish flooding.",
        alternative_explanations=[
            "Vegetation change",
            "Soil moisture",
            "Radar shadow and residual terrain effects",
            "Wind-roughened water and land-cover change",
        ],
        limitations=[
            "No contemporaneous spatial validation",
            "Thresholds are uncalibrated and channel-dependent",
            "Provisional product uncertainty",
            "Urban flooding and flooded vegetation may increase backscatter",
            "Hydrological context is not pixel validation",
            "Documented mask invalid/outside codes, explicit fill and numberOfLooks filters applied; other quality flags not interpreted",
        ],
        sources=source_urls,
        provenance=provenance,
        synthetic=synthetic,
        references_attempted=[
            "OPERA DSWx-S1 documentation reviewed; no aligned reference incorporated"
        ],
    )
    staging = Path(tempfile.mkdtemp(prefix=".processing-", dir=output_dir))
    try:
        preview(result["before_db"], staging / "before-preview.png", synthetic)
        preview(result["after_db"], staging / "after-preview.png", synthetic)
        with rasterio.open(
            staging / "delta-db.tif",
            "w",
            driver="GTiff",
            height=b.data.shape[0],
            width=b.data.shape[1],
            count=1,
            dtype="float32",
            crs=b.crs,
            transform=b.transform,
            nodata=np.nan,
            compress="deflate",
        ) as dst:
            dst.write(result["delta"].astype("float32"), 1)
            dst.update_tags(
                units="dB",
                synthetic=str(synthetic),
                description="after minus before gamma0 power in dB; not a flood map",
            )
        features = []
        for geometry, value in shapes(
            result["candidates"].astype("uint8"), mask=result["candidates"], transform=b.transform
        ):
            if value:
                features.append(
                    {
                        "type": "Feature",
                        "geometry": transform_geom(b.crs, "EPSG:4326", geometry),
                        "properties": {
                            "class": "open_water_change_candidate",
                            "synthetic": synthetic,
                            "validated": False,
                        },
                    }
                )
        write_json(
            staging / "change-candidates.geojson",
            {"type": "FeatureCollection", "features": features},
        )
        write_json(staging / "statistics.json", result["statistics"])
        write_json(staging / "evidence.json", evidence.model_dump(mode="json"))
        hashes = {p.name: checksum(p) for p in sorted(staging.iterdir())}
        analysis = Analysis(
            analysis_id=identifier,
            area_id=area.area_id,
            synthetic=synthetic,
            scenes=[before_scene, after_scene],
            parameters=parameters,
            statistics=result["statistics"],
            provenance=provenance,
            artifacts=hashes,
            evidence=evidence,
        )
        write_json(staging / "manifest.json", analysis.model_dump(mode="json"))
        for artifact in staging.iterdir():
            artifact.chmod(0o644)
        staging.chmod(0o755)
        os.rename(staging, target)
        return analysis
    finally:
        if staging.exists():
            shutil.rmtree(staging)
