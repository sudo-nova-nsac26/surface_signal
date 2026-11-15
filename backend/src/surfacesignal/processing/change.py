"""Compare compatible, masked GCOV radar power rasters on a metric grid.

Outputs are exploratory signal measurements, not remotely validated flood extents.
The caller is responsible for verifying scene compatibility and source quality.
""" 

import numpy as np
from rasterio.enums import Resampling
from rasterio.warp import reproject
from scipy.ndimage import binary_erosion, label

from surfacesignal.processing.gcov import Raster


def power_db(power):
    """Convert positive linear gamma0 power to dB; invalid cells remain NaN."""
    result = np.full(power.shape, np.nan, dtype="float32")
    valid = np.isfinite(power) & (power > 0)
    result[valid] = 10 * np.log10(power[valid])
    return result


def compare(
    before: Raster,
    after: Raster,
    *,
    delta_threshold=-3.0,
    water_threshold=-17.0,
    min_component_pixels=9,
    edge_pixels=1,
):
    """Align linear power, compute delta dB, and extract low-return candidates.

    The negative delta and low after-power thresholds are uncalibrated heuristics.
    A retained component is *not* a confirmed flood, damage or risk observation.
    Future work: qualify the detector against time-matched independent reference
    masks and document performance for each land-cover/acquisition regime.
    """
    if not before.crs.is_projected or before.crs.linear_units != "metre":
        raise ValueError("Analysis grid must use a projected metre CRS")
    if not all(np.isfinite([delta_threshold, water_threshold])) or delta_threshold >= 0:
        raise ValueError("Thresholds must be finite; decrease threshold must be negative")
    if min_component_pixels < 1 or edge_pixels < 0:
        raise ValueError("Invalid component size or edge erosion")
    aligned = after.data
    resampled = (
        before.crs != after.crs
        or before.transform != after.transform
        or before.data.shape != after.data.shape
    )
    if resampled:
        aligned = np.full(before.data.shape, np.nan, dtype="float32")
        reproject(
            source=after.data,
            destination=aligned,
            src_transform=after.transform,
            src_crs=after.crs,
            src_nodata=np.nan,
            dst_transform=before.transform,
            dst_crs=before.crs,
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )
    bdb, adb = power_db(before.data), power_db(aligned)
    valid = np.isfinite(bdb) & np.isfinite(adb)
    if edge_pixels:
        valid = binary_erosion(valid, iterations=edge_pixels, border_value=0)
    if not valid.any():
        raise ValueError("No common valid coverage after quality/edge filters")
    delta = np.where(valid, adb - bdb, np.nan)
    decrease = valid & (delta <= delta_threshold)
    candidates = decrease & (adb <= water_threshold)
    components, count = label(candidates)
    sizes = np.bincount(components.ravel())
    keep = sizes >= min_component_pixels
    keep[0] = False
    candidates = keep[components]
    _, retained = label(candidates)
    pixel_area = abs(
        before.transform.a * before.transform.e - before.transform.b * before.transform.d
    )
    n, c = int(valid.sum()), int(candidates.sum())
    return {
        "before_db": bdb,
        "after_db": adb,
        "delta": delta,
        "valid": valid,
        "candidates": candidates,
        "alignment": {
            "resampled": resampled,
            "method": "bilinear linear power" if resampled else "identical grid",
            "target_crs": before.crs.to_string(),
            "target_transform": list(before.transform)[:6],
        },
        "statistics": {
            "valid_pixels": n,
            "candidate_pixels": c,
            "valid_area_km2": n * pixel_area / 1e6,
            "candidate_area_km2": c * pixel_area / 1e6,
            "candidate_percent": 100 * c / n,
            "decrease_pixels": int(decrease.sum()),
            "candidate_components": int(retained),
            "raw_components": int(count),
            "mean_delta_db": float(np.nanmean(delta)),
            "pixel_area_m2": pixel_area,
            "classification": "open_water_change_candidates_not_confirmed_flood",
        },
    }


def agreement(prediction, reference, valid):
    if prediction.shape != reference.shape or valid.shape != reference.shape:
        raise ValueError("Aligned arrays and shared valid mask required")
    p, r = prediction[valid].astype(bool), reference[valid].astype(bool)
    tp, fp, fn, tn = [
        int(v) for v in ((p & r).sum(), (p & ~r).sum(), (~p & r).sum(), (~p & ~r).sum())
    ]

    def ratio(n, d):
        return n / d if d else None

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": ratio(tp, tp + fp),
        "recall": ratio(tp, tp + fn),
        "iou": ratio(tp, tp + fp + fn),
        "f1": ratio(2 * tp, 2 * tp + fp + fn),
    }
