# ruff: noqa: F811
import json

import pytest
from test_pipeline_api import client_for, prepared  # noqa: F401

from surfacesignal.config import Settings
from surfacesignal.processing.general_change import derive_analysis
from surfacesignal.publication import build_publication
from surfacesignal.storage import read_json


def test_publication_contract_and_idempotence(prepared):
    analysis, args, root = prepared
    client_for(root, args[-1])
    derive_analysis(root, analysis.analysis_id, min_component_pixels=1)
    output = root / "snapshot"
    output.mkdir()
    (output / "synthetic-demo.json").write_text('{"synthetic":true}')
    report = build_publication(Settings(root=root), "test", output)
    assert report["analysis_count"] == 1
    assert report["backup_path"]
    assert (root / report["backup_path"] / "synthetic-demo.json").exists()
    assert read_json(output / "analyses.json")["items"][0]["artifacts"] == analysis.artifacts
    assert not list(output.rglob("*.tif"))
    assert not list(output.rglob("manifest.json"))
    assert report == build_publication(Settings(root=root), "test", output)
    before = (output / "publication-report.json").read_bytes()
    with pytest.raises(ValueError, match="budget"):
        build_publication(Settings(root=root), "test", output, max_export_bytes=1)
    assert (output / "publication-report.json").read_bytes() == before
    for path in output.rglob("*.json"):
        json.loads(path.read_text())


def test_publication_requires_derived_and_safe_output(prepared):
    analysis, args, root = prepared
    client_for(root, args[-1])
    settings = Settings(root=root)
    with pytest.raises(ValueError):
        build_publication(settings, "test", root / "snapshot")
    derive_analysis(root, analysis.analysis_id)
    for output in [
        root,
        root / "artifacts/sub",
        root / "data/raw/sub",
        root / "config/sub",
        root / "backend/sub",
    ]:
        with pytest.raises(ValueError):
            build_publication(settings, "test", output)
    (root / "link").symlink_to(root / "elsewhere", target_is_directory=True)
    with pytest.raises(ValueError):
        build_publication(settings, "test", root / "link/snapshot")
    report = build_publication(settings, "test", root / "snapshot", exclude_synthetic=True)
    assert report["analysis_count"] == 0


def test_cli_build_and_reject_private_sources(prepared, capsys):
    from surfacesignal.cli import main
    from surfacesignal.storage import checksum, write_json

    analysis, args, root = prepared
    client_for(root, args[-1])
    assert (
        main(
            [
                "--root",
                str(root),
                "derive",
                "build",
                "--area",
                "test",
                "--min-component-pixels",
                "1",
            ]
        )
        == 0
    )
    assert (
        main(
            [
                "--root",
                str(root),
                "publish",
                "build",
                "--area",
                "test",
                "--output",
                str(root / "snapshot"),
                "--validate",
            ]
        )
        == 0
    )
    assert read_json(root / "snapshot/capabilities.json")["total"] == 8
    manifest_path = root / "artifacts" / analysis.analysis_id / "manifest.json"
    evidence_path = manifest_path.parent / "evidence.json"
    manifest = read_json(manifest_path)
    evidence = read_json(evidence_path)
    evidence["sources"] = ["https://example.org/data?access_token=secret"]
    write_json(evidence_path, evidence)
    manifest["evidence"] = evidence
    manifest["artifacts"]["evidence.json"] = checksum(evidence_path)
    write_json(manifest_path, manifest)
    derive_analysis(root, analysis.analysis_id)
    with pytest.raises(ValueError, match="Credential"):
        build_publication(Settings(root=root), "test", root / "unsafe-snapshot")
    assert not (root / "unsafe-snapshot").exists()


def test_publication_matches_shared_api(prepared):
    analysis, args, root = prepared
    client = client_for(root, args[-1])
    derive_analysis(root, analysis.analysis_id)
    output = root / "snapshot"
    build_publication(Settings(root=root), "test", output)
    from surfacesignal.publication import _rewrite

    for route, filename in [
        ("layers", "layers.json"),
        ("capabilities", "capabilities.json"),
        ("methodology", "methodology.json"),
        ("stories?lang=en", "stories.en.json"),
        (f"analyses/{analysis.analysis_id}", f"analyses/{analysis.analysis_id}.json"),
        (
            f"analyses/{analysis.analysis_id}/statistics",
            f"analyses/{analysis.analysis_id}/statistics.json",
        ),
        (
            f"analyses/{analysis.analysis_id}/story?lang=en",
            f"analyses/{analysis.analysis_id}/story.en.json",
        ),
        ("areas/test/timeline?lang=pt", "areas/test/timeline.pt.json"),
        ("areas/test/overview?lang=en", "areas/test/overview.en.json"),
    ]:
        response = client.get("/api/v1/" + route)
        assert response.status_code == 200, route
        expected = _rewrite(response.json())
        actual = read_json(output / filename)
        # Exported collection pages contain the complete selected collection.
        if "items" in expected and "limit" in expected:
            expected["limit"] = actual["limit"]
        assert actual == expected, route


@pytest.mark.parametrize("tampering", ["extra_file", "removed_inventory", "symlink_parent"])
def test_reuse_rejects_changed_snapshot_inventory(prepared, tampering):
    from surfacesignal.storage import write_json

    analysis, args, root = prepared
    client_for(root, args[-1])
    derive_analysis(root, analysis.analysis_id)
    output = root / "snapshot"
    build_publication(Settings(root=root), "test", output)
    if tampering == "extra_file":
        (output / "raw.h5").write_bytes(b"private")
    elif tampering == "removed_inventory":
        report = read_json(output / "publication-report.json")
        report["files"].pop("areas.json")
        write_json(output / "publication-report.json", report)
    else:
        (output / "scenes").mkdir(exist_ok=True)
        (output / "scenes" / "unexpected").symlink_to(root, target_is_directory=True)
    with pytest.raises(ValueError, match="inventory|integrity|Symlink"):
        build_publication(Settings(root=root), "test", output)
    assert output.exists()
    if tampering == "extra_file":
        assert (output / "raw.h5").read_bytes() == b"private"


def test_publication_rejects_unresolved_urls_before_replacement(prepared, monkeypatch):
    from surfacesignal.api.service import Repository

    analysis, args, root = prepared
    client_for(root, args[-1])
    derive_analysis(root, analysis.analysis_id)
    output = root / "snapshot"
    build_publication(Settings(root=root), "test", output)
    original = (output / "publication-report.json").read_bytes()
    original_layers = Repository.layers

    def broken_layers(self, *args):
        result = original_layers(self, *args)
        result.items[0].artifact_url = "/api/v1/missing"
        return result

    monkeypatch.setattr(Repository, "layers", broken_layers)
    with pytest.raises(ValueError, match="Unresolved internal"):
        build_publication(Settings(root=root), "test", output)
    assert (output / "publication-report.json").read_bytes() == original
