"""Distribution fixtures need no source raster or scientific processing."""

import gzip
import io
import tarfile
from pathlib import Path

import pytest

from surfacesignal.snapshots import (
    build_compact_snapshot,
    build_full_snapshot,
    fetch_snapshot,
    verify_snapshot_directory,
)
from surfacesignal.storage import checksum, read_json, write_json


@pytest.fixture
def snapshot(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    write_json(
        source / "analyses.json",
        {"items": [{"analysis_id": "one", "synthetic": False}], "total": 1},
    )
    write_json(source / "areas.json", {"items": [], "total": 0})
    write_json(source / "statistics.json", {"area_km2": None, "candidate_area_m2": 123})
    features = [
        {
            "type": "Feature",
            "properties": {"source_area_m2": n},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, 0], [0, n], [n, n], [n, 0], [0, 0]]],
            },
        }
        for n in range(1, 5)
    ]
    write_json(source / "shape.geojson", {"type": "FeatureCollection", "features": features})
    write_json(source / "link.json", {"url": "/data/api/v1/shape.geojson"})
    hashes = {p.name: checksum(p) for p in source.iterdir()}
    write_json(
        source / "publication-report.json",
        {"publication_id": "original", "analysis_count": 1, "scene_count": 0, "files": hashes},
    )
    return tmp_path, source


def package(snapshot):
    root, source = snapshot
    dist = root / "distribution"
    return root, source, dist, build_full_snapshot(source, dist, root=root)


def test_compact_preserves_science_and_tracks_loss(snapshot):
    root, source = snapshot
    original = {p.name: p.read_bytes() for p in source.iterdir()}
    output = root / "compact"
    report = build_compact_snapshot(source, output, root=root, max_features=2)
    assert report["delivery"]["visualization_only"]
    geometry = read_json(output / "shape.geojson")
    assert len(geometry["features"]) == 2
    assert geometry["delivery"]["omitted_feature_count"] == 2
    assert geometry["delivery"]["source_sha256"] == checksum(source / "shape.geojson")
    assert read_json(output / "link.json")["url"] == "/data/compact/api/v1/shape.geojson"
    assert read_json(output / "statistics.json") == read_json(source / "statistics.json")
    assert original == {p.name: p.read_bytes() for p in source.iterdir()}
    assert report == build_compact_snapshot(source, output, root=root, max_features=2)
    assert verify_snapshot_directory(output)
    before = (output / "publication-report.json").read_bytes()
    with pytest.raises(ValueError, match="budget"):
        build_compact_snapshot(source, output, root=root, max_total_bytes=1)
    assert (output / "publication-report.json").read_bytes() == before


def test_reproducible_archive_local_install_cache_and_backup(snapshot):
    root, source, dist, manifest = package(snapshot)
    archive = dist / manifest["archive"]["filename"]
    first = archive.read_bytes()
    assert manifest == build_full_snapshot(source, dist, root=root)
    assert first == archive.read_bytes()
    output = root / "installed"
    output.mkdir()
    (output / "old.json").write_text('{"history":true}')
    result = fetch_snapshot(str(dist / "snapshot-manifest.json"), output, root=root)
    assert result["reused"] is False
    assert (Path(result["backup_path"]) / "old.json").exists()
    assert {p.name: p.read_bytes() for p in output.iterdir()} == {
        p.name: p.read_bytes() for p in source.iterdir()
    }
    archive.unlink()
    result = fetch_snapshot(str(dist / "snapshot-manifest.json"), output, root=root)
    assert result["reused"] is True and result["archive_reused"] is True
    # Changing an installed file never passes as a reused verified snapshot.
    (output / "areas.json").write_text('{"tampered":true}')
    result = fetch_snapshot(str(dist / "snapshot-manifest.json"), output, root=root)
    assert not result["reused"]
    assert read_json(output / "areas.json") == read_json(source / "areas.json")


def malicious_package(dist, manifest, members, *, trailing=b""):
    archive = dist / manifest["archive"]["filename"]
    with archive.open("wb") as raw:
        with gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as gz:
            with tarfile.open(fileobj=gz, mode="w|", format=tarfile.USTAR_FORMAT) as tar:
                for name, payload, kind in members:
                    info = tarfile.TarInfo(name)
                    info.type = kind
                    info.size = len(payload) if kind == tarfile.REGTYPE else 0
                    if kind == tarfile.SYMTYPE:
                        info.linkname = "../../escape"
                    tar.addfile(info, io.BytesIO(payload) if kind == tarfile.REGTYPE else None)
            gz.write(trailing)
    manifest["archive"]["sha256"] = checksum(archive)
    manifest["archive"]["bytes"] = archive.stat().st_size
    write_json(dist / "snapshot-manifest.json", manifest)


@pytest.mark.parametrize(
    "attack",
    [
        "traversal",
        "absolute",
        "backslash",
        "duplicate",
        "symlink",
        "hardlink",
        "unexpected",
        "hash",
        "trailing",
        "bomb",
        "missing",
    ],
)
def test_unsafe_archives_preserve_previous_snapshot(snapshot, attack):
    root, source, dist, manifest = package(snapshot)
    members = [(name, (source / name).read_bytes(), tarfile.REGTYPE) for name in manifest["files"]]
    first = members[0]
    trailing = b""
    if attack == "traversal":
        members.insert(0, ("../escape.json", b"{}", tarfile.REGTYPE))
    elif attack == "absolute":
        members.insert(0, ("/escape.json", b"{}", tarfile.REGTYPE))
    elif attack == "backslash":
        members.insert(0, ("sub\\escape.json", b"{}", tarfile.REGTYPE))
    elif attack == "duplicate":
        members.append(first)
    elif attack == "symlink":
        members[0] = (first[0], b"", tarfile.SYMTYPE)
    elif attack == "hardlink":
        members[0] = (first[0], b"", tarfile.LNKTYPE)
    elif attack == "unexpected":
        members.append(("extra.json", b"{}", tarfile.REGTYPE))
    elif attack == "hash":
        members[0] = (first[0], b"X" * len(first[1]), tarfile.REGTYPE)
    elif attack == "trailing":
        trailing = b"hidden extra content"
    elif attack == "bomb":
        trailing = bytes(100_000)
    else:
        members.pop()
    malicious_package(dist, manifest, members, trailing=trailing)
    output = root / "installed"
    output.mkdir()
    (output / "old.json").write_text("old")
    with pytest.raises(ValueError):
        fetch_snapshot(
            str(dist / "snapshot-manifest.json"), output, root=root, max_total_bytes=10_000
        )
    assert (output / "old.json").read_text() == "old"
    assert not (root / "escape.json").exists()
    assert not list(root.glob(".snapshot-*"))


def test_corruption_inventory_and_budgets(snapshot):
    root, source, dist, manifest = package(snapshot)
    output = root / "installed"
    path = str(dist / "snapshot-manifest.json")
    with pytest.raises(ValueError, match="Manifest SHA256"):
        fetch_snapshot(path, output, root=root, expected_manifest_sha256="0" * 64)
    with pytest.raises(ValueError, match="budget"):
        fetch_snapshot(path, output, root=root, max_archive_bytes=1)
    with pytest.raises(ValueError, match="budget"):
        fetch_snapshot(path, output, root=root, max_file_bytes=1)
    with pytest.raises(ValueError, match="budget"):
        fetch_snapshot(path, output, root=root, max_total_bytes=1)
    archive = dist / manifest["archive"]["filename"]
    archive.write_bytes(archive.read_bytes()[:-1] + b"X")
    with pytest.raises(ValueError, match="Archive SHA256"):
        fetch_snapshot(path, output, root=root)
    write_json(source / "extra.json", {})
    with pytest.raises(ValueError, match="inventory"):
        build_full_snapshot(source, dist, root=root)
    (source / "extra.json").unlink()
    (source / "shape.geojson").unlink()
    (source / "shape.geojson").symlink_to(source / "areas.json")
    with pytest.raises(ValueError, match="Symlink"):
        build_compact_snapshot(source, root / "compact", root=root)


def test_manifest_version_corruption_and_duplicate_keys(snapshot):
    root, _source, dist, manifest = package(snapshot)
    manifest["files"]["areas.json"]["sha256"] = "0" * 64
    write_json(dist / "snapshot-manifest.json", manifest)
    with pytest.raises(ValueError, match="version"):
        fetch_snapshot(str(dist / "snapshot-manifest.json"), root / "out", root=root)
    (dist / "snapshot-manifest.json").write_text('{"mode":"full","mode":"compact"}')
    with pytest.raises(ValueError, match="Duplicate"):
        fetch_snapshot(str(dist / "snapshot-manifest.json"), root / "out", root=root)


def test_anonymous_http_download_and_reuse(snapshot):
    import functools
    import http.server
    import threading

    root, _source, dist, _manifest = package(snapshot)
    requests = []

    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            requests.append(
                (self.path, self.headers.get("Authorization"), self.headers.get("Cookie"))
            )
            super().do_GET()

        def log_message(self, *_args):
            pass

    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(Handler, directory=dist)
    )
    url = f"http://127.0.0.1:{server.server_port}"
    build_full_snapshot(snapshot[1], dist, root=root, base_url=url)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        manifest_url = url + "/snapshot-manifest.json"
        result = fetch_snapshot(manifest_url, root / "installed", root=root)
        assert not result["archive_reused"]
        result = fetch_snapshot(manifest_url, root / "installed", root=root)
        assert result["archive_reused"]
        assert len([path for path, _, _ in requests if path.endswith(".tar.gz")]) == 1
        assert all(auth is None and cookie is None for _, auth, cookie in requests)
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.mark.parametrize(
    "url",
    [
        "https://user:pass@example.com/a",
        "https://example.com/a?token=secret",
        "http://example.com/a",
        "file:///tmp/a",
    ],
)
def test_rejects_nonanonymous_urls(snapshot, url):
    root, _ = snapshot
    with pytest.raises(ValueError, match="URL"):
        fetch_snapshot(url, root / "installed", root=root)


def test_geometry_byte_cap_is_enforced_and_documented(snapshot):
    root, source = snapshot
    output = root / "compact"
    report = build_compact_snapshot(source, output, root=root, max_geometry_bytes=1500)
    assert (output / "shape.geojson").stat().st_size <= 1500
    assert report["delivery"]["parameters"]["max_geometry_bytes"] == 1500
    assert read_json(output / "shape.geojson")["delivery"]["display_feature_count"] <= 4


def test_nonfinite_json_and_local_source_paths_are_rejected(snapshot):
    root, source = snapshot
    (source / "statistics.json").write_text('{"value":NaN}')
    with pytest.raises(ValueError, match="Nonfinite"):
        build_full_snapshot(source, root / "dist", root=root)
    write_json(source / "statistics.json", {"source_path": "/private/raw.json"})
    with pytest.raises(ValueError, match="Private"):
        build_full_snapshot(source, root / "dist", root=root)


def test_rebuild_detects_corrupt_verified_cache(snapshot):
    root, _source, dist, manifest = package(snapshot)
    path = str(dist / "snapshot-manifest.json")
    output = root / "out"
    fetch_snapshot(path, output, root=root)
    cached = root / "data/snapshot-cache" / (manifest["archive"]["sha256"] + ".tar.gz")
    cached.write_bytes(b"corrupt")
    result = fetch_snapshot(path, output, root=root)
    assert result["archive_reused"] is False
    assert result["reused"] is True
    assert checksum(cached) == manifest["archive"]["sha256"]


def test_base_url_does_not_claim_release_was_uploaded(snapshot):
    root, source = snapshot
    manifest = build_full_snapshot(
        source, root / "dist", root=root, base_url="https://example.org/prepared"
    )
    assert manifest["published"] is False
    assert manifest["publication_status"] == "prepared_not_uploaded"
    assert manifest["archive"]["url"].startswith("https://example.org/prepared/")


def test_install_rollback_on_interruption_preserves_current_snapshot(snapshot, monkeypatch):
    import surfacesignal.snapshots as snapshots

    root, _source, dist, _manifest = package(snapshot)
    output = root / "installed"
    output.mkdir()
    (output / "previous.json").write_text("history")
    rename = snapshots.os.rename

    def interrupted(source, destination):
        if Path(source).name.startswith(".snapshot-") and Path(destination) == output:
            raise KeyboardInterrupt
        return rename(source, destination)

    monkeypatch.setattr(snapshots.os, "rename", interrupted)
    with pytest.raises(KeyboardInterrupt):
        fetch_snapshot(str(dist / "snapshot-manifest.json"), output, root=root)
    assert (output / "previous.json").read_text() == "history"
    assert not list(root.glob(".snapshot-*"))
