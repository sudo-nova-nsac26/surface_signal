"""Additive public source and static distribution commands."""

from pathlib import Path

from surfacesignal.storage import read_json


def add_delivery_commands(groups, publish):
    sources = groups.add_parser(
        "sources", help="Public credential-free environmental acquisition"
    ).add_subparsers(dest="command", required=True)
    for command in ("check", "fetch"):
        action = sources.add_parser(command)
        action.add_argument("--area", default="vale-do-taquari")
        action.add_argument("--source", action="append", dest="source_ids")
        action.add_argument("--start")
        action.add_argument("--end")
        action.add_argument("--max-download-bytes", type=int, default=100_000_000)
        action.add_argument("--max-pixels", type=int, default=2_000_000)
        if command == "fetch":
            action.add_argument("--dry-run", action="store_true")
    for command in ("compact", "full"):
        action = publish.add_parser(command)
        action.add_argument("--area", required=True)
        action.add_argument("--output", type=Path)
        action.add_argument(
            "--source",
            type=Path,
            help="Reuse a verified existing snapshot instead of reading scientific stores",
        )
        action.add_argument("--max-export-bytes", type=int, default=250_000_000)
        if command == "full":
            action.add_argument(
                "--base-url", help="Intended public release directory; does not upload anything"
            )
    data = groups.add_parser("data").add_subparsers(dest="command", required=True)
    action = data.add_parser("fetch-snapshot")
    action.add_argument("--manifest", help="Public HTTPS manifest URL or local manifest file")
    action.add_argument("--output", type=Path)
    action.add_argument("--manifest-sha256")
    action.add_argument("--max-archive-bytes", type=int, default=100_000_000)
    action.add_argument("--max-total-bytes", type=int, default=300_000_000)


def run_delivery_command(settings, args):
    if args.group == "sources":
        from surfacesignal.providers.public_sources import (
            check_public_sources,
            fetch_public_sources,
        )

        function = check_public_sources if args.command == "check" else fetch_public_sources
        kwargs = dict(
            source_ids=args.source_ids,
            start=args.start,
            end=args.end,
            max_download_bytes=args.max_download_bytes,
            max_pixels=args.max_pixels,
        )
        if args.command == "fetch":
            kwargs["dry_run"] = args.dry_run
        return function(settings, args.area, **kwargs)
    if args.group == "data":
        from surfacesignal.snapshots import fetch_snapshot

        manifest = args.manifest or settings.snapshot_manifest
        if not manifest:
            descriptor = settings.root / "config/snapshot-manifest.json"
            if descriptor.is_file():
                manifest = read_json(descriptor).get("manifest_url")
        if not manifest:
            raise ValueError(
                "No full snapshot release configured. Use --manifest <published HTTPS URL or local manifest>; the bundled compact snapshot needs no download."
            )
        return fetch_snapshot(
            manifest,
            args.output or settings.root / "frontend/public/data/api/v1",
            root=settings.root,
            expected_manifest_sha256=args.manifest_sha256,
            max_archive_bytes=args.max_archive_bytes,
            max_total_bytes=args.max_total_bytes,
        )
    from surfacesignal.publication import build_publication
    from surfacesignal.snapshots import build_compact_snapshot, build_full_snapshot

    source = args.source or settings.root / "frontend/public/data/api/v1"
    if args.source is None:
        build_publication(
            settings,
            args.area,
            source,
            exclude_synthetic=True,
            include_environmental_context=True,
            max_export_bytes=args.max_export_bytes,
        )
    if args.command == "compact":
        return build_compact_snapshot(
            source,
            args.output or settings.root / "frontend/public/data/compact/api/v1",
            root=settings.root,
        )
    return build_full_snapshot(
        source,
        args.output or settings.root / "data/exports/full",
        root=settings.root,
        base_url=args.base_url,
    )
