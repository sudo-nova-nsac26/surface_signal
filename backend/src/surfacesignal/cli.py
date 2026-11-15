import argparse
import json
import sys
import time
from datetime import UTC, date, datetime
from pathlib import Path

import rasterio
from shapely.geometry import shape

from surfacesignal.config import Settings
from surfacesignal.domain import Scene, shortlist
from surfacesignal.main import load_areas, load_scenes
from surfacesignal.processing.gcov import crop, inspect_gcov
from surfacesignal.processing.history import run_history, verify_history
from surfacesignal.processing.pipeline import run_analysis
from surfacesignal.providers.asf import ProviderError, download, search
from surfacesignal.providers.hydro import read_records
from surfacesignal.storage import read_json, safe_id, write_json


def parser():
    root = argparse.ArgumentParser(
        description="SurfaceSignal exploratory experiment; not operational flood monitoring"
    )
    root.add_argument(
        "--root", type=Path, help="Repository/data root (defaults to SURFACESIGNAL_ROOT)"
    )
    groups = root.add_subparsers(dest="group", required=True)
    scenes = groups.add_parser("scenes").add_subparsers(dest="command", required=True)
    find = scenes.add_parser("search")
    find.add_argument("--area", required=True)
    find.add_argument("--start", required=True)
    find.add_argument("--end", required=True)
    pairs = scenes.add_parser("shortlist")
    pairs.add_argument("--area", required=True)
    pairs.add_argument("--event", required=True)
    inspect = scenes.add_parser("inspect")
    inspect.add_argument("--scene-id", required=True)
    get = scenes.add_parser("download")
    get.add_argument("--scene-id", required=True)
    get.add_argument("--max-gb", type=float, required=True)
    imp = scenes.add_parser("import")
    imp.add_argument("--file", type=Path, required=True)
    gcov = groups.add_parser("gcov").add_subparsers(dest="command", required=True)
    inspect = gcov.add_parser("inspect")
    inspect.add_argument("--file", type=Path, required=True)
    inspect.add_argument("--output", type=Path)
    cut = gcov.add_parser("crop")
    cut.add_argument("--file", type=Path, required=True)
    cut.add_argument("--area", required=True)
    cut.add_argument("--output", type=Path, required=True)
    cut.add_argument("--frequency", choices=["A", "B"], default="A")
    cut.add_argument("--channel", default="HHHH")
    analysis = groups.add_parser("analyze")
    analysis.add_argument("--area", required=True)
    analysis.add_argument("--before", required=True, help="Catalog scene ID")
    analysis.add_argument("--after", required=True, help="Catalog scene ID")
    analysis.add_argument("--frequency", choices=["A", "B"], default="A")
    analysis.add_argument("--channel", default="HHHH")
    analysis.add_argument("--delta-threshold", type=float, default=-3)
    analysis.add_argument("--water-threshold", type=float, default=-17)
    analysis.add_argument("--min-component-pixels", type=int, default=9)
    analysis.add_argument("--edge-pixels", type=int, default=1)
    analysis.add_argument("--min-looks", type=float, default=1)
    analysis.add_argument("--hydro-csv", type=Path)
    history = groups.add_parser("history").add_subparsers(dest="command", required=True)
    run = history.add_parser("run", help="Download, retain and compare the snapshot history")
    run.add_argument("--snapshot", type=Path, default=Path("docs/evidence/asf-catalog.json"))
    run.add_argument("--with-validated-through", type=date.fromisoformat)
    run.add_argument("--dry-run", action="store_true")
    verify = history.add_parser(
        "verify", help="Verify local raw files, report and artifact hashes offline"
    )
    verify.add_argument("--area", required=True)
    for action in analysis._actions:
        if action.dest in {
            "frequency",
            "channel",
            "delta_threshold",
            "water_threshold",
            "min_component_pixels",
            "edge_pixels",
            "min_looks",
            "hydro_csv",
        }:
            run.add_argument(
                *action.option_strings,
                type=action.type,
                default=action.default,
                choices=action.choices,
            )
    derive = groups.add_parser("derive").add_subparsers(dest="command", required=True)
    build = derive.add_parser("build")
    build.add_argument("--area", required=True)
    build.add_argument("--threshold-db", type=float, default=3.0)
    build.add_argument("--min-component-pixels", type=int, default=9)
    preparation = groups.add_parser("preparation").add_subparsers(dest="command", required=True)
    build = preparation.add_parser(
        "build", help="Build historical evidence and preparation proposals offline"
    )
    build.add_argument("--area", required=True)
    build.add_argument("--context", type=Path)
    build.add_argument("--illustrative", action="store_true", help="Select synthetic analyses only")
    for flag, default in [
        ("max-input-bytes", 25_000_000),
        ("max-features", 50_000),
        ("max-coordinates", 1_000_000),
        ("max-output-bytes", 25_000_000),
    ]:
        build.add_argument("--" + flag, type=int, default=default)
    verify = preparation.add_parser(
        "verify", help="Verify report integrity and current input identities"
    )
    verify.add_argument("--area", required=True)
    publish = groups.add_parser("publish").add_subparsers(dest="command", required=True)
    build = publish.add_parser("build")
    build.add_argument("--area", required=True)
    build.add_argument("--output", type=Path, required=True)
    build.add_argument("--validate", action="store_true")
    build.add_argument("--exclude-synthetic", action="store_true")
    build.add_argument("--include-previews", action="store_true")
    build.add_argument("--include-preparation", action="store_true")
    build.add_argument("--max-export-bytes", type=int, default=100_000_000)
    return root


def main(argv=None):
    args = parser().parse_args(argv)
    settings = Settings(root=args.root) if args.root else Settings()

    def area(identifier):
        return next((a for a in load_areas(settings) if a.area_id == identifier), None)

    def scene(identifier):
        value = next(
            (
                s
                for s in load_scenes(settings)
                if s.scene_id == identifier
                and (not hasattr(args, "area") or s.area_id == args.area)
            ),
            None,
        )
        if value is None:
            raise ValueError("Scene not found in local catalog; run scenes search/import")
        return value

    try:
        selected_area = area(args.area) if hasattr(args, "area") else None
        if hasattr(args, "area") and selected_area is None and args.group != "history":
            raise ValueError("Area not found in configuration")
        if args.group == "history":
            if args.command == "verify":
                result = verify_history(settings, args.area)
                print(json.dumps(result, indent=2, allow_nan=False))
                return 0 if result["verified"] and result["completed"] else 3
            from surfacesignal.processing.history import DEFAULT_PARAMETERS

            last_progress = 0.0

            def progress(event):
                nonlocal last_progress
                if event["event"] == "pair":
                    print(
                        f"Pair [{event['pair']}/{event['pairs']}]: {event['status']}",
                        file=sys.stderr,
                        flush=True,
                    )
                    return
                now = time.monotonic()
                if event["event"] != "bytes" or now - last_progress >= 2:
                    print(
                        f"[{event['file']}/{event['files']}] {event['scene_id']}: {event['bytes']:,}/{event['total_bytes']:,} bytes ({event['event']})",
                        file=sys.stderr,
                        flush=True,
                    )
                    last_progress = now

            result = run_history(
                settings,
                args.snapshot,
                validated_through=args.with_validated_through,
                parameters={k: getattr(args, k) for k in DEFAULT_PARAMETERS},
                hydro_csv=args.hydro_csv,
                dry_run=args.dry_run,
                progress=progress,
            )
            if not args.dry_run:
                result = {
                    k: result[k]
                    for k in (
                        "area_id",
                        "completed",
                        "downloads_complete",
                        "scene_counts",
                        "pair_counts",
                        "collections",
                        "report_path",
                        "error",
                    )
                }
        elif args.group == "preparation":
            from surfacesignal.preparation.models import Budgets
            from surfacesignal.preparation.store import build_preparation, verify_preparation

            if args.command == "verify":
                result = verify_preparation(settings, args.area)
            else:
                result = build_preparation(
                    settings,
                    args.area,
                    context_path=args.context,
                    illustrative=args.illustrative,
                    budgets=Budgets(**{k: getattr(args, k) for k in Budgets.model_fields}),
                )
        elif args.group == "derive":
            from surfacesignal.api.service import Repository
            from surfacesignal.processing.general_change import derive_analysis

            result = {
                "area_id": args.area,
                "derived": [
                    derive_analysis(
                        settings.root,
                        a.analysis_id,
                        threshold_db=args.threshold_db,
                        min_component_pixels=args.min_component_pixels,
                        max_pixels=selected_area.max_pixels,
                    )
                    for a in Repository(settings).analyses(area_id=args.area)
                ],
            }
        elif args.group == "publish":
            from surfacesignal.publication import build_publication

            result = build_publication(
                settings,
                args.area,
                args.output,
                validate=args.validate,
                exclude_synthetic=args.exclude_synthetic,
                include_previews=args.include_previews,
                include_preparation=args.include_preparation,
                max_export_bytes=args.max_export_bytes,
            )
        elif args.group == "scenes":
            if args.command == "search":
                start, end = datetime.fromisoformat(args.start), datetime.fromisoformat(args.end)
                if start > end:
                    raise ValueError("start must not exceed end")
                values = search(shape(selected_area.geometry).wkt, args.start, args.end, args.area)
                result = {
                    "area_id": args.area,
                    "scenes": [s.model_dump(mode="json") for s in values],
                    "accessed_at": datetime.now(UTC).isoformat(),
                    "query": {
                        "start": args.start,
                        "end": args.end,
                        "geometry": selected_area.geometry,
                        "dataMaturity": "PROVISIONAL",
                        "processingLevel": "GCOV",
                        "dataset": "NISAR",
                    },
                    "complete": True,
                }
                write_json(settings.catalog_dir / (safe_id(args.area) + ".json"), result)
                result = {
                    "scene_count": len(values),
                    "catalog": str(settings.catalog_dir / (args.area + ".json")),
                }
            elif args.command == "import":
                result = read_json(args.file)
                identifier = safe_id(result["area_id"])
                for value in result["scenes"]:
                    if Scene.model_validate(value).area_id != identifier:
                        raise ValueError("Snapshot area mismatch")
                write_json(settings.catalog_dir / (identifier + ".json"), result)
                result = {"imported_scenes": len(result["scenes"])}
            elif args.command == "inspect":
                result = scene(args.scene_id).model_dump(mode="json")
            elif args.command == "shortlist":
                event = datetime.fromisoformat(args.event)
                if event.tzinfo is None:
                    event = event.replace(tzinfo=UTC)
                result = shortlist(
                    [s for s in load_scenes(settings) if s.area_id == args.area], event
                )
            elif args.command == "download":
                path = download(scene(args.scene_id), settings.root / "data/raw", args.max_gb)
                result = {"file": str(path)}
        elif args.group == "gcov":
            if args.command == "inspect":
                result = inspect_gcov(args.file)
                if args.output:
                    write_json(args.output, result)
            else:
                raster = crop(
                    args.file, selected_area, frequency=args.frequency, channel=args.channel
                )
                args.output.parent.mkdir(parents=True, exist_ok=True)
                with rasterio.open(
                    args.output,
                    "w",
                    driver="GTiff",
                    height=raster.data.shape[0],
                    width=raster.data.shape[1],
                    count=1,
                    dtype="float32",
                    crs=raster.crs,
                    transform=raster.transform,
                    nodata=float("nan"),
                ) as dst:
                    dst.write(raster.data, 1)
                    dst.update_tags(units="gamma0 linear power")
                result = {"file": str(args.output), "metadata": raster.metadata}
        else:
            before, after = scene(args.before), scene(args.after)
            result = run_analysis(
                settings.root / "data/raw" / (safe_id(before.scene_id) + ".h5"),
                settings.root / "data/raw" / (safe_id(after.scene_id) + ".h5"),
                before,
                after,
                selected_area,
                settings.artifacts_dir,
                frequency=args.frequency,
                channel=args.channel,
                delta_threshold=args.delta_threshold,
                water_threshold=args.water_threshold,
                min_component_pixels=args.min_component_pixels,
                edge_pixels=args.edge_pixels,
                min_looks=args.min_looks,
                hydro_records=read_records(args.hydro_csv) if args.hydro_csv else [],
            ).model_dump(mode="json")
        print(json.dumps(result, indent=2, allow_nan=False))
        if args.group == "history" and not args.dry_run and not result["completed"]:
            return 3
        return 0
    except ProviderError as exc:
        print(f"External provider unavailable: {exc}", file=sys.stderr)
        return 3
    except KeyboardInterrupt:
        print(
            "Interrupted; completed raw files and checkpoints were retained. Rerun the same history command to resume.",
            file=sys.stderr,
        )
        return 130
    except (ValueError, KeyError, OSError) as exc:
        # Never print arbitrary file content, URLs containing credentials, or provider bodies.
        message = (
            str(exc)
            if isinstance(exc, ValueError) and type(exc) is ValueError
            else "Invalid or inaccessible local input; inspect config/file schema"
        )
        print(f"Input error: {message}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
