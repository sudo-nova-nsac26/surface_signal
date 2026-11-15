"""UTC interval integration with explicit missing coverage."""

from datetime import timedelta

from surfacesignal.context.models import RainInterval, utc


def accumulate_rainfall(records, observed_at, *, windows=(24, 48, 72), minimum_coverage=1.0):
    if not 0 < minimum_coverage <= 1:
        raise ValueError("Coverage threshold must be in (0, 1]")
    end = utc(observed_at)
    intervals = sorted([RainInterval.model_validate(r) for r in records], key=lambda r: r.start)
    for a, b in zip(intervals, intervals[1:], strict=False):
        if a.end > b.start:
            raise ValueError("Overlapping rainfall intervals")
    values, coverage = {}, {}
    for hours in windows:
        start = end - timedelta(hours=hours)
        seconds = 0.0
        amount = 0.0
        for item in intervals:
            duration = (min(end, item.end) - max(start, item.start)).total_seconds()
            if duration <= 0 or item.value is None or item.quality_status != "valid":
                continue
            # A total for a partially intersecting interval cannot be apportioned without assumptions.
            if item.unit == "mm" and (item.start < start or item.end > end):
                continue
            seconds += duration
            amount += item.value * duration / 3600 if item.unit == "mm/h" else item.value
        key = f"{hours}h"
        coverage[key] = seconds / (hours * 3600)
        values[key] = amount if coverage[key] >= minimum_coverage else None
    return {
        "windows_mm": values,
        "coverage_by_window": coverage,
        "coverage_fraction": min(coverage.values()),
    }
