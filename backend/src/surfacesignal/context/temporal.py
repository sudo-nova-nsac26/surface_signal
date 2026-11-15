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


def summarize_daily_labels(records, observed_at):
    """Sum prior complete date labels, never claim exact acquisition-hour rainfall."""
    end = utc(observed_at).replace(hour=0, minute=0, second=0, microsecond=0)
    intervals = [RainInterval.model_validate(r) for r in records]
    by_day = {}
    for item in intervals:
        if (
            (item.end - item.start).total_seconds() != 86400
            or item.start != item.start.replace(hour=0, minute=0, second=0, microsecond=0)
            or item.unit != "mm"
        ):
            raise ValueError("Complete UTC daily labels in mm required")
        if item.start in by_day:
            raise ValueError("Duplicate daily rainfall label")
        by_day[item.start] = item
    totals, coverage = {}, {}
    for days in (1, 2, 3):
        selected = [by_day.get(end - timedelta(days=n)) for n in range(1, days + 1)]
        valid = [r for r in selected if r and r.value is not None and r.quality_status == "valid"]
        key = f"{days}d"
        coverage[key] = len(valid) / days
        totals[key] = sum(r.value for r in valid) if len(valid) == days else None
    return {
        "end_label_exclusive": end.isoformat(),
        "totals_mm": totals,
        "coverage_by_days": coverage,
        "semantics": "Prior complete UTC date labels; mixed station observation windows; not acquisition-hour totals.",
    }
