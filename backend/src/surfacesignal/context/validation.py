"""Conservative agreement metrics on explicitly shared valid coverage only."""

from datetime import datetime

from surfacesignal.context.spatial import _geometry, _projectors, transform


def compare_reference(
    candidate,
    reference,
    candidate_coverage,
    reference_coverage,
    *,
    observed_at,
    reference_at,
    tolerance_hours,
    independent,
    quality_verified,
    reference_id,
    min_coverage_fraction=0.99,
):
    unavailable = {
        "status": "not_validated",
        "reference_id": reference_id,
        "metrics": None,
        "coverage": None,
        "limitations": [],
        "provenance": {
            "method_version": "environmental-reference-agreement-v1",
            "tolerance_hours": tolerance_hours,
            "min_coverage_fraction": min_coverage_fraction,
        },
    }
    if not 0 < min_coverage_fraction <= 1 or tolerance_hours < 0:
        raise ValueError("Invalid validation thresholds")
    if not independent or not quality_verified:
        unavailable["limitations"] = ["Reference independence and quality must be verified"]
        return unavailable
    if not candidate_coverage or not reference_coverage or not reference:
        unavailable["limitations"] = ["Explicit candidate and reference valid coverage required"]
        return unavailable
    observed = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
    acquired = datetime.fromisoformat(reference_at.replace("Z", "+00:00"))
    if observed.tzinfo is None or acquired.tzinfo is None:
        raise ValueError("Timezone-aware validation instants required")
    offset = abs((observed - acquired).total_seconds()) / 3600
    unavailable["provenance"]["time_offset_hours"] = offset
    if offset > tolerance_hours:
        unavailable["limitations"] = ["Reference exceeds temporal tolerance"]
        return unavailable
    valid_candidate, valid_reference = _geometry(candidate_coverage), _geometry(reference_coverage)
    _, project = _projectors(valid_candidate)
    coverage = transform(project, valid_candidate.intersection(valid_reference))
    candidate_area = transform(project, valid_candidate).area
    fraction = coverage.area / candidate_area
    unavailable["coverage"] = {"shared_valid_km2": coverage.area / 1e6, "fraction": fraction}
    if fraction < min_coverage_fraction or coverage.is_empty:
        unavailable["limitations"] = ["Insufficient shared valid reference coverage"]
        return unavailable
    detected = transform(project, _geometry(candidate)).intersection(coverage)
    truth = transform(project, _geometry(reference)).intersection(coverage)
    tp = detected.intersection(truth).area
    fp, fn = detected.difference(truth).area, truth.difference(detected).area
    tn = coverage.difference(detected.union(truth)).area

    def ratio(a, b):
        return a / b if b > 0 else None

    return {
        **unavailable,
        "status": "validated_against_reference",
        "metrics": {
            "true_positive_km2": tp / 1e6,
            "false_positive_km2": fp / 1e6,
            "false_negative_km2": fn / 1e6,
            "true_negative_km2": tn / 1e6,
            "precision": ratio(tp, tp + fp),
            "recall": ratio(tp, tp + fn),
            "iou": ratio(tp, tp + fp + fn),
        },
        "limitations": [
            "Agreement with this qualified reference only; not general accuracy or ground truth"
        ],
    }
