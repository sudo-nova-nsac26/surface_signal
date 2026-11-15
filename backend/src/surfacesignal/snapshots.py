"""Reproducible public snapshots and bounded, anonymous, atomic installation.

These are delivery derivatives, never scientific inputs. No raw source is copied.
"""

import gzip
import hashlib
import json
import math
import os
import re
import shutil
import tarfile
import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import urljoin, urlsplit

import httpx

from surfacesignal.publication import _check_public, _target, _validate_internal_urls
from surfacesignal.storage import checksum, read_json, write_json

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 300_000_000
MAX_ARCHIVE_BYTES = 100_000_000
MAX_FILES = 20_000
MANIFEST_BYTES = 4_000_000


def _json_bytes(value):
    return (
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"
    ).encode()


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _invalid_constant(_value):
    raise ValueError("Nonfinite JSON number")


def _json(data):
    try:
        return json.loads(data, object_pairs_hook=_unique_pairs, parse_constant=_invalid_constant)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid snapshot JSON") from exc


def _positive(value, name):
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"Invalid {name} budget")
    return value


def _path(name):
    if not isinstance(name, str) or "\\" in name or "\x00" in name:
        raise ValueError("Unsafe snapshot path")
    p = PurePosixPath(name)
    if (
        not name
        or p.is_absolute()
        or p.as_posix() != name
        or any(part in {".", ".."} or ":" in part for part in p.parts)
        or p.suffix not in {".json", ".geojson", ".png"}
    ):
        raise ValueError("Unsafe snapshot path")
    return p


def _no_symlinks(path):
    for parent in [path, *path.parents]:
        if parent.is_symlink():
            raise ValueError("Symlinked snapshot path")


def _inventory(source, max_total_bytes, max_file_bytes):
    _no_symlinks(source)
    if not source.is_dir():
        raise ValueError("Snapshot source is not a directory")
    files, total = {}, 0
    for path in sorted(source.rglob("*")):
        if path.is_symlink():
            raise ValueError("Symlinked snapshot inventory")
        if path.is_dir():
            continue
        if not path.is_file():
            raise ValueError("Nonregular snapshot file")
        name = path.relative_to(source).as_posix()
        _path(name)
        size = path.stat().st_size
        total += size
        if size > max_file_bytes or total > max_total_bytes or len(files) >= MAX_FILES:
            raise ValueError("Snapshot exceeds file/total byte or count budget")
        if path.suffix in {".json", ".geojson"}:
            data = path.read_bytes()
            payload = _json(data)
            _check_public(payload, source)
            normalized = (
                _json(data.replace(b"/data/compact/api/v1/", b"/data/api/v1/"))
                if b"/data/compact/api/v1/" in data
                else payload
            )
            _validate_internal_urls(normalized, source)
        else:
            _check_png(path)
        files[name] = {"sha256": checksum(path), "bytes": size}
    report = _json((source / "publication-report.json").read_bytes())
    if not isinstance(report, dict):
        raise ValueError("Invalid publication report")
    expected = {
        name: entry["sha256"] for name, entry in files.items() if name != "publication-report.json"
    }
    if report.get("files") != expected:
        raise ValueError("Snapshot publication inventory/hash mismatch")
    return files


def verify_snapshot_directory(
    source: Path, *, max_total_bytes=MAX_TOTAL_BYTES, max_file_bytes=MAX_FILE_BYTES
) -> dict:
    """Verify exact report inventory, content hashes, paths and bounded public files."""
    _positive(max_total_bytes, "total")
    _positive(max_file_bytes, "file")
    return _inventory(Path(source).absolute(), max_total_bytes, max_file_bytes)


def _check_png(path, max_pixels=16_000_000):
    from PIL import Image

    with Image.open(path) as image:
        if image.format != "PNG" or image.width * image.height > max_pixels:
            raise ValueError("Snapshot image exceeds pixel budget or is not PNG")
        image.verify()


def _install(staging, output, files):
    """Replace a complete directory only after validation; retain its prior contents."""
    _no_symlinks(output)
    staging.chmod(0o755)
    if output.exists():
        old = {}
        for path in sorted(output.rglob("*")):
            if path.is_symlink() or (not path.is_dir() and not path.is_file()):
                raise ValueError("Unsafe previous snapshot")
            if path.is_file():
                old[path.relative_to(output).as_posix()] = checksum(path)
        wanted = {name: entry["sha256"] for name, entry in files.items()}
        if old == wanted:
            return {"reused": True, "backup_path": None}
        old_id = hashlib.sha256(_json_bytes(old)).hexdigest()[:16]
        backup = output.with_name(output.name + ".backup-" + old_id)
        if backup.exists():
            raise ValueError("Previous snapshot backup already exists; preserve before retrying")
    else:
        backup = None
    try:
        if backup:
            os.rename(output, backup)
        os.rename(staging, output)
    except BaseException:
        if backup and backup.exists() and not output.exists():
            os.rename(backup, output)
        raise
    return {"reused": False, "backup_path": str(backup) if backup else None}


def _compact_urls(value):
    if isinstance(value, dict):
        return {key: _compact_urls(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_compact_urls(item) for item in value]
    if isinstance(value, str) and value.startswith("/data/api/v1/"):
        return value.replace("/data/api/v1/", "/data/compact/api/v1/", 1)
    return value


def _coordinate_count(value):
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return 1
        return sum(_coordinate_count(item) for item in value)
    return 0


def _round_coordinates(value):
    if isinstance(value, (tuple, list)):
        return [_round_coordinates(item) for item in value]
    return round(value, 6) if isinstance(value, float) else value


def _compact_geometry(payload, source_sha, max_features, tolerance, max_bytes):
    from shapely.geometry import mapping, shape

    features = payload.get("features", [])
    shapes = [
        (index, feature, shape(feature["geometry"])) for index, feature in enumerate(features)
    ]
    # Keep the largest shapes deterministically; this is a display selection only.
    selected = sorted(shapes, key=lambda item: (-item[2].area, item[0]))[:max_features]
    points_before = sum(_coordinate_count(f["geometry"].get("coordinates", [])) for f in features)
    current_tolerance = tolerance
    for _attempt in range(12):
        result = []
        for _index, feature, geometry in selected:
            simplified = geometry.simplify(current_tolerance, preserve_topology=True)
            if simplified.is_empty:
                continue
            result.append({**feature, "geometry": _round_coordinates(mapping(simplified))})
        metadata = {
            "visualization_only": True,
            "not_for_measurement": True,
            "source_sha256": source_sha,
            "source_feature_count": len(features),
            "display_feature_count": len(result),
            "omitted_feature_count": len(features) - len(result),
            "source_coordinate_count": points_before,
            "display_coordinate_count": sum(
                _coordinate_count(f["geometry"].get("coordinates", [])) for f in result
            ),
            "simplify_tolerance_degrees": current_tolerance,
            "coordinate_decimals": 6,
            "selection": "largest planar geometry areas, original index breaks ties",
            "statistics": "Scientific statistics and feature properties retain original unsimplified values; never recompute from display geometry.",
        }
        output = {**payload, "features": result, "delivery": metadata}
        if len(_json_bytes(output)) <= max_bytes:
            return output, metadata
        current_tolerance *= 2
        if _attempt >= 5:
            selected = selected[: max(1, len(selected) // 2)]
    raise ValueError("Compact geometry exceeds file byte budget")


def build_compact_snapshot(
    source: Path,
    output: Path,
    *,
    root: Path,
    max_total_bytes=16_000_000,
    max_file_bytes=2_000_000,
    max_features=100,
    simplify_tolerance=0.0001,
    max_geometry_bytes=125_000,
) -> dict:
    """Create a small checked-in display snapshot, preserving every summary and source hash."""
    for value, name in [
        (max_total_bytes, "total"),
        (max_file_bytes, "file"),
        (max_features, "feature"),
        (max_geometry_bytes, "geometry byte"),
    ]:
        _positive(value, name)
    if not math.isfinite(simplify_tolerance) or simplify_tolerance <= 0:
        raise ValueError("Invalid simplification tolerance")
    source = Path(source).absolute()
    output = _target(root, output)
    if source == output or source.is_relative_to(output) or output.is_relative_to(source):
        raise ValueError("Overlapping snapshot source/output")
    original = _inventory(source, MAX_TOTAL_BYTES, MAX_FILE_BYTES)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".compact-", dir=output.parent))
    losses = {}
    try:
        for name, record in original.items():
            if name == "publication-report.json":
                continue
            path = staging / name
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.suffix in {".json", ".geojson"}:
                value = _json((source / name).read_bytes())
                if path.suffix == ".geojson" and value.get("type") == "FeatureCollection":
                    value, losses[name] = _compact_geometry(
                        value,
                        record["sha256"],
                        max_features,
                        simplify_tolerance,
                        min(max_file_bytes, max_geometry_bytes),
                    )
                path.write_bytes(_json_bytes(_compact_urls(value)))
            else:
                shutil.copyfile(source / name, path)
        hashes = {
            p.relative_to(staging).as_posix(): checksum(p)
            for p in sorted(staging.rglob("*"))
            if p.is_file()
        }
        previous = read_json(source / "publication-report.json")
        identity = {
            "files": hashes,
            "source_report_sha256": original["publication-report.json"]["sha256"],
            "parameters": {
                "max_features": max_features,
                "max_geometry_bytes": max_geometry_bytes,
                "max_file_bytes": max_file_bytes,
                "max_total_bytes": max_total_bytes,
                "simplify_tolerance_degrees": simplify_tolerance,
                "coordinate_decimals": 6,
            },
        }
        report = {
            **previous,
            "publication_id": hashlib.sha256(_json_bytes(identity)).hexdigest()[:24],
            "files": hashes,
            "file_count": len(hashes),
            "bytes": sum(p.stat().st_size for p in staging.rglob("*") if p.is_file()),
            "backup_path": None,
            "delivery": {
                "mode": "compact",
                "visualization_only": True,
                **identity,
                "geometry_derivatives": losses,
                "artifact_hash_scope": "Scientific artifact digest maps retain source hashes. This report files map hashes delivered bytes; geometry delivery.source_sha256 links each display derivative to its original.",
            },
        }
        write_json(staging / "publication-report.json", report)
        files = _inventory(staging, max_total_bytes, max_file_bytes)
        # Check links with the ordinary publication validator after converting only URL roots.
        for path in staging.rglob("*.json"):
            raw = path.read_text().replace("/data/compact/api/v1/", "/data/api/v1/")
            _validate_internal_urls(_json(raw), staging)
        if _inventory(source, MAX_TOTAL_BYTES, MAX_FILE_BYTES) != original:
            raise ValueError("Snapshot source changed during compact build")
        _install(staging, output, files)
        return report
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def build_full_snapshot(
    source: Path,
    distribution: Path,
    *,
    root: Path,
    base_url: str | None = None,
    max_total_bytes=MAX_TOTAL_BYTES,
    max_file_bytes=MAX_FILE_BYTES,
) -> dict:
    """Package verified public files deterministically; never upload or publish them."""
    _positive(max_total_bytes, "total")
    _positive(max_file_bytes, "file")
    if max_file_bytes > MAX_FILE_BYTES:
        raise ValueError("File budget exceeds Cloudflare Pages 25 MiB limit")
    source = Path(source).absolute()
    files = _inventory(source, max_total_bytes, max_file_bytes)
    distribution = _target(root, distribution)
    if (
        source == distribution
        or distribution.is_relative_to(source)
        or source.is_relative_to(distribution)
    ):
        raise ValueError("Overlapping snapshot source/distribution")
    distribution.mkdir(parents=True, exist_ok=True)
    core = {
        "schema_version": 1,
        "mode": "full",
        "files": files,
        "file_count": len(files),
        "total_bytes": sum(f["bytes"] for f in files.values()),
        "limits": {
            "max_file_bytes": max_file_bytes,
            "max_total_bytes": max_total_bytes,
            "max_image_pixels": 16_000_000,
        },
    }
    version = hashlib.sha256(_json_bytes(core)).hexdigest()[:24]
    filename = f"surfacesignal-full-{version}.tar.gz"
    fd, temporary = tempfile.mkstemp(prefix=".archive-", dir=distribution)
    try:
        with os.fdopen(fd, "wb") as raw:
            with gzip.GzipFile(
                filename="", mode="wb", fileobj=raw, mtime=0, compresslevel=9
            ) as compressed:
                with tarfile.open(
                    fileobj=compressed, mode="w|", format=tarfile.USTAR_FORMAT
                ) as tar:
                    for name, record in files.items():
                        info = tarfile.TarInfo(name)
                        info.size = record["bytes"]
                        info.mode = 0o644
                        info.mtime = 0
                        info.uid = info.gid = 0
                        with (source / name).open("rb") as data:
                            tar.addfile(info, data)
        if _inventory(source, max_total_bytes, max_file_bytes) != files:
            raise ValueError("Snapshot source changed during packaging")
        archive = Path(temporary)
        sha = checksum(archive)
        archive.chmod(0o644)
        target = distribution / filename
        if target.exists():
            _no_symlinks(target)
            if checksum(target) != sha:
                raise ValueError("Versioned archive exists with different bytes")
        else:
            os.replace(archive, target)
        if base_url:
            _url(base_url)
        report = {
            **core,
            "version": version,
            "published": False,
            "publication_status": "prepared_not_uploaded",
            "archive": {
                "filename": filename,
                "url": base_url.rstrip("/") + "/" + filename if base_url else None,
                "sha256": sha,
                "bytes": target.stat().st_size,
            },
        }
        write_json(distribution / f"snapshot-manifest-{version}.json", report)
        write_json(distribution / "snapshot-manifest.json", report)
        return report
    finally:
        Path(temporary).unlink(missing_ok=True)


def _url(value):
    if not isinstance(value, str):
        raise ValueError("Invalid snapshot URL")
    parsed = urlsplit(value)
    try:
        _ = parsed.port
    except ValueError as exc:
        raise ValueError("Invalid snapshot URL port") from exc
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if (
        parsed.username
        or parsed.password
        or parsed.fragment
        or parsed.query
        or not parsed.hostname
        or (parsed.scheme != "https" and not (parsed.scheme == "http" and local))
    ):
        raise ValueError("Snapshot URL must be anonymous HTTPS (HTTP only on loopback)")
    return value


def _download_impl(url, target, limit):
    """No credentials, environment proxy/auth, cookies or cross-request session state."""
    with httpx.Client(trust_env=False, timeout=60) as client:
        for _redirect in range(6):
            _url(url)
            with client.stream("GET", url, headers={"Accept-Encoding": "identity"}) as response:
                if response.is_redirect:
                    url = urljoin(url, response.headers.get("location", ""))
                    client.cookies.clear()
                    continue
                response.raise_for_status()
                if response.headers.get("content-encoding", "identity") != "identity":
                    raise ValueError("Unexpected HTTP compression")
                size = 0
                with target.open("wb") as file:
                    for chunk in response.iter_raw():
                        size += len(chunk)
                        if size > limit:
                            raise ValueError("Download exceeds archive/manifest byte budget")
                        file.write(chunk)
                return
    raise ValueError("Too many snapshot redirects")


def _download(url, target, limit):
    try:
        _download_impl(url, target, limit)
    except httpx.HTTPError as exc:
        raise ValueError(
            "Anonymous snapshot download failed; check public URL and network"
        ) from exc


def _validate_manifest(manifest, max_archive_bytes, max_total_bytes, max_file_bytes):
    if not isinstance(manifest, dict):
        raise ValueError("Invalid snapshot manifest")
    if manifest.get("schema_version") != 1 or manifest.get("mode") != "full":
        raise ValueError("Unsupported snapshot manifest")
    archive = manifest.get("archive", {})
    files = manifest.get("files", {})
    if not isinstance(archive, dict):
        raise ValueError("Invalid archive descriptor")
    if not isinstance(files, dict) or not files or len(files) > MAX_FILES:
        raise ValueError("Invalid snapshot file inventory")
    total = 0
    for name, record in files.items():
        _path(name)
        if not isinstance(record, dict) or not re.fullmatch(
            r"[a-f0-9]{64}", str(record.get("sha256", ""))
        ):
            raise ValueError("Invalid snapshot file hash")
        size = record.get("bytes")
        if isinstance(size, bool) or not isinstance(size, int) or size < 0 or size > max_file_bytes:
            raise ValueError("Snapshot exceeds file byte budget")
        total += size
    if (
        total > max_total_bytes
        or manifest.get("total_bytes") != total
        or manifest.get("file_count") != len(files)
    ):
        raise ValueError("Snapshot exceeds total byte budget or inventory differs")
    size = archive.get("bytes")
    if isinstance(size, bool) or not isinstance(size, int) or size < 1 or size > max_archive_bytes:
        raise ValueError("Snapshot exceeds archive byte budget")
    if not re.fullmatch(r"[a-f0-9]{64}", str(archive.get("sha256", ""))):
        raise ValueError("Invalid archive SHA256")
    core = {
        k: manifest[k]
        for k in ("schema_version", "mode", "files", "file_count", "total_bytes", "limits")
    }
    version = hashlib.sha256(_json_bytes(core)).hexdigest()[:24]
    if (
        manifest.get("version") != version
        or archive.get("filename") != f"surfacesignal-full-{version}.tar.gz"
    ):
        raise ValueError("Snapshot manifest version mismatch")
    return files


class _BoundedReader:
    def __init__(self, file, limit):
        self.file, self.limit, self.count = file, limit, 0

    def read(self, size=-1):
        chunk = self.file.read(
            min(size if size >= 0 else self.limit + 1, self.limit - self.count + 1)
        )
        self.count += len(chunk)
        if self.count > self.limit:
            raise ValueError("Archive decompression exceeds byte budget")
        return chunk


def _unpack(archive, staging, files, max_total_bytes, max_file_bytes):
    seen, total = set(), 0
    # Parse only USTAR regular-file headers. tarfile's reader transparently consumes
    # extension headers before returning members; doing so could conceal extra paths.
    expanded_limit = max_total_bytes + len(files) * 1024 + 10240
    with archive.open("rb") as raw, gzip.GzipFile(fileobj=raw) as compressed:
        bounded = _BoundedReader(compressed, expanded_limit)
        while True:
            header = bounded.read(512)
            if len(header) != 512:
                raise ValueError("Truncated archive header")
            if not any(header):
                if bounded.read(512) != bytes(512):
                    raise ValueError("Missing archive end marker")
                while chunk := bounded.read(1024 * 1024):
                    if any(chunk):
                        raise ValueError("Unexpected trailing archive data")
                break
            try:
                member = tarfile.TarInfo.frombuf(header, encoding="utf-8", errors="strict")
            except (tarfile.TarError, UnicodeError) as exc:
                raise ValueError("Invalid archive header") from exc
            _path(member.name)
            if member.name in seen:
                raise ValueError("Duplicate archive path")
            if member.type != tarfile.REGTYPE or header[257:263] != b"ustar\x00":
                raise ValueError("Archive symlink, nonregular file or extension is forbidden")
            if member.name not in files:
                raise ValueError("Unexpected archive file")
            record = files[member.name]
            total += member.size
            if (
                member.size < 0
                or member.size != record["bytes"]
                or member.size > max_file_bytes
                or total > max_total_bytes
            ):
                raise ValueError("Archive exceeds size budget or manifest differs")
            seen.add(member.name)
            destination = staging / member.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256()
            remaining = member.size
            with destination.open("xb") as output:
                while remaining:
                    chunk = bounded.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError("Truncated archive member")
                    remaining -= len(chunk)
                    digest.update(chunk)
                    output.write(chunk)
            if digest.hexdigest() != record["sha256"]:
                raise ValueError("Archive member SHA256 mismatch")
            padding = (-member.size) % 512
            if bounded.read(padding) != bytes(padding):
                raise ValueError("Invalid archive padding")
    if seen != set(files):
        raise ValueError("Archive missing manifest files")


def fetch_snapshot(
    manifest_url: str,
    output: Path,
    *,
    root: Path,
    cache_dir: Path | None = None,
    expected_manifest_sha256: str | None = None,
    max_archive_bytes=MAX_ARCHIVE_BYTES,
    max_total_bytes=MAX_TOTAL_BYTES,
    max_file_bytes=MAX_FILE_BYTES,
) -> dict:
    """Fetch a public release or local manifest, validate completely, then install.

    A local manifest may reference a sibling archive via filename when URL is null.
    A SHA256 supplied by an independently trusted channel also pins the manifest.
    """
    for value, name in [
        (max_archive_bytes, "archive"),
        (max_total_bytes, "total"),
        (max_file_bytes, "file"),
    ]:
        _positive(value, name)
    if max_file_bytes > MAX_FILE_BYTES:
        raise ValueError("File budget exceeds Cloudflare Pages 25 MiB limit")
    output = _target(root, output)
    cache = _target(root, cache_dir or Path(root) / "data/snapshot-cache")
    if output == cache or output.is_relative_to(cache) or cache.is_relative_to(output):
        raise ValueError("Overlapping cache/output")
    cache.mkdir(parents=True, exist_ok=True)
    local = None
    if urlsplit(str(manifest_url)).scheme:
        fd, name = tempfile.mkstemp(prefix=".manifest-", dir=cache)
        os.close(fd)
        try:
            _download(str(manifest_url), Path(name), MANIFEST_BYTES)
            data = Path(name).read_bytes()
        finally:
            Path(name).unlink(missing_ok=True)
    else:
        local = Path(manifest_url).absolute()
        _no_symlinks(local)
        if local.stat().st_size > MANIFEST_BYTES:
            raise ValueError("Manifest exceeds byte budget")
        data = local.read_bytes()
    if expected_manifest_sha256 and hashlib.sha256(data).hexdigest() != expected_manifest_sha256:
        raise ValueError("Manifest SHA256 mismatch")
    manifest = _json(data)
    files = _validate_manifest(manifest, max_archive_bytes, max_total_bytes, max_file_bytes)
    archive_record = manifest["archive"]
    cached = cache / (archive_record["sha256"] + ".tar.gz")
    _no_symlinks(cached)
    archive_reused = (
        cached.is_file()
        and cached.stat().st_size == archive_record["bytes"]
        and checksum(cached) == archive_record["sha256"]
    )
    if not archive_reused:
        fd, name = tempfile.mkstemp(prefix=".download-", dir=cache)
        os.close(fd)
        download = Path(name)
        try:
            if local and not archive_record.get("url"):
                origin = local.parent / archive_record["filename"]
                _no_symlinks(origin)
                if origin.stat().st_size > max_archive_bytes:
                    raise ValueError("Archive exceeds byte budget")
                shutil.copyfile(origin, download)
            else:
                if not archive_record.get("url"):
                    raise ValueError("No published snapshot archive URL; release is not published")
                _download(
                    archive_record["url"], download, min(max_archive_bytes, archive_record["bytes"])
                )
            if (
                download.stat().st_size != archive_record["bytes"]
                or checksum(download) != archive_record["sha256"]
            ):
                raise ValueError("Archive SHA256 or byte count mismatch")
            download.chmod(0o644)
            os.replace(download, cached)
        finally:
            download.unlink(missing_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".snapshot-", dir=output.parent))
    try:
        try:
            _unpack(cached, staging, files, max_total_bytes, max_file_bytes)
        except (EOFError, tarfile.TarError) as exc:
            raise ValueError("Invalid or truncated snapshot archive") from exc
        actual = _inventory(staging, max_total_bytes, max_file_bytes)
        if actual != files:
            raise ValueError("Installed snapshot inventory differs")
        for path in staging.rglob("*.json"):
            _check_public(_json(path.read_bytes()), root)
            _validate_internal_urls(read_json(path), staging)
        installation = _install(staging, output, files)
        return {
            "version": manifest["version"],
            "archive_sha256": archive_record["sha256"],
            "archive_reused": archive_reused,
            "file_count": len(files),
            "total_bytes": manifest["total_bytes"],
            **installation,
        }
    finally:
        if staging.exists():
            shutil.rmtree(staging)
