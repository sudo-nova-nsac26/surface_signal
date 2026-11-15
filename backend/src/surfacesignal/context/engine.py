"""Assemble context for one already prepared SAR comparison, offline."""

from datetime import UTC, datetime
from importlib.metadata import version

from surfacesignal.context.importer import current_imports, digest
from surfacesignal.context.models import (
    ContextDataset,
    ContextValidation,
    EnvironmentalContextReport,
    EnvironmentalEvent,
    EvidenceSource,
    HistoricalWater,
    HydroObservation,
    LandCover,
    RainfallContext,
    ReferenceLayer,
    Topography,
)
from surfacesignal.context.temporal import accumulate_rainfall
from surfacesignal.storage import checksum


def assemble(settings, analysis, area, budgets, *, minimum_coverage=1.0):
    from surfacesignal.context.enrichment import (
        candidate_geometry,
        candidate_summary,
        validate_reference,
    )
    from surfacesignal.processing.pipeline import verify_artifacts

    verify_artifacts(settings.artifacts_dir / analysis.analysis_id)
    imports = current_imports(settings, area.area_id, budgets)
    # Never mix illustrative environmental measurements into a real SAR result.
    selected = [
        i
        for i in imports
        if i["dataset"]["synthetic"] == analysis.synthetic
        and i["dataset"]["redistribution_allowed"]
    ]
    identity = {
        "analysis_id": analysis.analysis_id,
        "area_id": area.area_id,
        "geometry": area.geometry,
        "analysis_sha256": checksum(
            settings.artifacts_dir / analysis.analysis_id / "manifest.json"
        ),
        "imports": [digest(i) for i in selected],
        "method_version": "environmental-context-v1.1",
        "software_versions": {
            name: version(name) for name in ("numpy", "rasterio", "shapely", "pyproj", "pydantic")
        },
        "minimum_coverage": minimum_coverage,
        "budgets": budgets.model_dump(),
    }
    before, after = analysis.scenes
    report = EnvironmentalContextReport(
        area_id=area.area_id,
        analysis_id=analysis.analysis_id,
        observed_at=after.start_time,
        generated_at=datetime.now(UTC),
        data_status="unavailable",
        synthetic=analysis.synthetic,
        provenance={
            "input_sha256": [i["dataset"]["source_sha256"] for i in selected],
            "method_version": "environmental-context-v1.1",
            "software_versions": {
                name: version(name)
                for name in ("numpy", "rasterio", "shapely", "pyproj", "pydantic")
            },
            "identity": identity,
            "spatial_summaries": {},
        },
    )
    candidate = (
        candidate_geometry(settings, analysis, budgets)
        if any("spatial" in i["normalized"] or "reference" in i["normalized"] for i in selected)
        else None
    )
    report.provenance["candidate_summaries"] = {}
    events, layers = [], []
    for item in selected:
        dataset = ContextDataset.model_validate(item["dataset"])
        source = dataset.source_id
        normal = item["normalized"]
        report.sources.append(
            EvidenceSource(
                source_id=source,
                name=dataset.provider,
                url=dataset.source_url,
                product=dataset.dataset_id,
                dataset_version=dataset.dataset_version,
                license_id=dataset.license_id,
                reference_year=dataset.parameters.get("reference_year"),
                observed_start=dataset.observed_start,
                observed_end=dataset.observed_end,
                resolution_m=dataset.spatial_resolution_m,
                synthetic=dataset.synthetic,
                redistribution_allowed=dataset.redistribution_allowed,
                limitations=dataset.limitations,
            )
        )
        if "hydrology" in normal:
            records = [HydroObservation.model_validate(r) for r in normal["hydrology"]]
            records = [
                r
                for r in records
                if abs((r.observed_at - after.start_time).total_seconds()) <= 86400
            ]
            for record in records:
                record.time_offset_hours = (
                    record.observed_at - after.start_time
                ).total_seconds() / 3600
                event = EnvironmentalEvent(
                    event_id=digest(record.model_dump(mode="json", exclude={"time_offset_hours"}))[
                        :24
                    ],
                    source_id=source,
                    kind="station_measurement",
                    observed_at=record.observed_at,
                    station_id=record.station_id,
                    station_name=record.station_name,
                    parameter=record.parameter,
                    value=record.value,
                    unit=record.unit,
                    synthetic=record.synthetic,
                    quality_status=record.quality_status,
                    analysis_id=None,
                )
                events.append(event.model_dump(mode="json"))
            report.hydrology.records.extend(records)
        if "rainfall" in normal:
            acquisitions = {
                name: accumulate_rainfall(
                    normal["rainfall"], scene.start_time, minimum_coverage=minimum_coverage
                )
                for name, scene in [("before", before), ("after", after)]
            }
            summary = acquisitions["after"]
            available = sum(v is not None for v in summary["windows_mm"].values())
            report.rainfall = RainfallContext(
                status="available" if available == 3 else "partial" if available else "unavailable",
                product=dataset.dataset_id,
                run=dataset.parameters["run"],
                resolution_km_approx=dataset.spatial_resolution_m / 1000
                if dataset.spatial_resolution_m
                else None,
                **summary,
                acquisitions=acquisitions,
                limitations=dataset.limitations
                + ["Regional estimate; not rainfall at SAR pixel resolution."],
            )
            for window, value in summary["windows_mm"].items():
                from datetime import timedelta

                events.append(
                    EnvironmentalEvent(
                        event_id=digest([analysis.analysis_id, source, window])[:24],
                        source_id=source,
                        kind="rainfall_window",
                        observed_at=after.start_time,
                        observed_start=after.start_time - timedelta(hours=int(window[:-1])),
                        observed_end=after.start_time,
                        parameter=window,
                        value=value,
                        unit="mm",
                        synthetic=dataset.synthetic,
                        quality_status="valid" if value is not None else "missing",
                        analysis_id=analysis.analysis_id,
                    ).model_dump(mode="json")
                )
        if "reference" in normal:
            result = ContextValidation.model_validate(
                validate_reference(settings, analysis, item, candidate, budgets)
            )
            if report.validation.metrics is None:
                report.validation = result
        if "spatial" in normal:
            report.provenance["candidate_summaries"][source] = candidate_summary(
                settings, analysis, item, candidate, budgets
            )
            summary = normal["spatial"]
            report.provenance["spatial_summaries"][source] = summary
            for sid, field, model in [
                ("mapbiomas-water", "historical_water", HistoricalWater),
                ("worldcover", "land_cover", LandCover),
                ("copernicus-dem", "topography", Topography),
            ]:
                if source == sid:
                    values = {k: v for k, v in summary.items() if k in model.model_fields}
                    values["limitations"] = (
                        summary.get("limitations", [])
                        + dataset.limitations
                        + ["Summary uses the configured AOI; not confirmed impacts."]
                    )
                    setattr(report, field, model.model_validate(values))
            layers.append(
                ReferenceLayer(
                    layer_id=source,
                    status=summary.get("status", "unavailable"),
                    title=dataset.dataset_id,
                    role="historical_context"
                    if source in {"mapbiomas-water", "worldcover"}
                    else "environmental_context",
                    reference_year=dataset.parameters.get("reference_year"),
                    source_id=source,
                    limitations=dataset.limitations
                    + ["Prepared statistics only; no raster distributed."],
                    redistribution_allowed=True,
                    synthetic=dataset.synthetic,
                ).model_dump(mode="json")
            )
    records = report.hydrology.records
    if records:
        measured = sum(r.value is not None for r in records)
        report.hydrology.status = (
            "available" if measured == len(records) else "partial" if measured else "unavailable"
        )
        report.hydrology.stations = [
            {
                "station_id": sid,
                "station_name": next(r.station_name for r in records if r.station_id == sid),
            }
            for sid in sorted({r.station_id for r in records})
        ]
        report.hydrology.limitations = [
            "Station levels have separate datums; no cross-station level comparison."
        ]
    statuses = [
        getattr(report, key).status
        for key in ("rainfall", "hydrology", "historical_water", "land_cover", "topography")
    ]
    report.data_status = (
        "available"
        if all(s == "available" for s in statuses)
        else "partial"
        if any(s in {"available", "partial"} for s in statuses)
        else "unavailable"
    )
    return identity, {
        "environmental-context.json": report.model_dump(mode="json"),
        "validation.json": report.validation.model_dump(mode="json"),
        "reference-layers.json": {"area_id": area.area_id, "items": layers},
        "environmental-events.json": {
            "items": events,
            "total": len(events),
            "offset": 0,
            "limit": max(1, len(events)),
        },
    }
