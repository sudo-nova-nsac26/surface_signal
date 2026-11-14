import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import rasterio
from shapely.geometry import shape

from surfacesignal.config import Settings
from surfacesignal.domain import Scene, shortlist
from surfacesignal.main import load_areas, load_scenes
from surfacesignal.processing.gcov import crop, inspect_gcov
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
        if hasattr(args, "area") and selected_area is None:
            raise ValueError("Area not found in configuration")
        if args.group == "scenes":
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
        return 0
    except ProviderError as exc:
        print(f"External provider unavailable: {exc}", file=sys.stderr)
        return 3
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
