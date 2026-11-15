"""Export only verified, public prepared context alongside selected SAR products."""

from surfacesignal.context.store import load_context
from surfacesignal.providers.environmental import context_sources


def emit_environmental_context(settings, area_id, analyses, exclude_synthetic, emit):
    sources = context_sources()
    emit("context-sources.json", _page(sources))
    events = {}
    layers = {}
    for analysis in analyses:
        try:
            prepared = load_context(settings, analysis.analysis_id)
        except FileNotFoundError:
            # Omission preserves context_not_prepared as a static HTTP 404.
            continue
        payloads = prepared["payloads"]
        report = payloads["environmental-context.json"]
        if report["area_id"] != area_id or report["analysis_id"] != analysis.analysis_id:
            raise ValueError("Environmental context selection differs from publication")
        if exclude_synthetic and report["synthetic"]:
            continue
        if any(not source["redistribution_allowed"] for source in report["sources"]):
            raise ValueError("Environmental context redistribution is not authorized")
        prefix = f"analyses/{analysis.analysis_id}"
        emit(f"{prefix}/environmental-context.json", report)
        emit(f"{prefix}/validation.json", payloads["validation.json"])
        for event in payloads["environmental-events.json"]["items"]:
            if not exclude_synthetic or not event["synthetic"]:
                events[event["event_id"]] = event
        for layer in payloads["reference-layers.json"]["items"]:
            if exclude_synthetic and layer["synthetic"]:
                continue
            # V1 publishes bounded statistics and reference metadata. An overlay
            # must have an explicit copying/verification path before publication.
            if layer["artifact_url"] is not None:
                raise ValueError("Environmental overlay has no authorized publication adapter")
            layers[(layer["layer_id"], layer["synthetic"])] = layer
    emit(
        f"areas/{area_id}/environmental-events.json",
        _page(sorted(events.values(), key=lambda event: (event["observed_at"], event["event_id"]))),
    )
    emit(
        f"areas/{area_id}/reference-layers.json",
        {"area_id": area_id, "items": list(layers.values())},
    )


def _page(items):
    return {"items": items, "total": len(items), "offset": 0, "limit": max(1, len(items))}
