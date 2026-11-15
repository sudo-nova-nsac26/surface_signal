"""Offline command compatibility and optional dotenv configuration."""

from pathlib import Path

import pytest

from surfacesignal.cli import parser
from surfacesignal.config import Settings


def test_delivery_commands_have_safe_defaults():
    args = parser().parse_args(["sources", "check"])
    assert args.area == "vale-do-taquari"
    assert args.max_download_bytes == 100_000_000
    args = parser().parse_args(["context", "build", "--area", "vale-do-taquari"])
    assert args.analysis is None
    for command in ["compact", "full"]:
        args = parser().parse_args(["publish", command, "--area", "vale-do-taquari"])
        assert args.command == command
    args = parser().parse_args(["data", "fetch-snapshot"])
    assert args.manifest is None


def test_dotenv_credentials_are_optional_private_and_consistent(tmp_path, monkeypatch):
    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    monkeypatch.delenv("SURFACESIGNAL_EARTHDATA_TOKEN", raising=False)
    monkeypatch.delenv("ANA_API_TOKEN", raising=False)
    path = tmp_path / ".env"
    path.write_text(
        "EARTHDATA_TOKEN=synthetic-secret\nANA_API_TOKEN=synthetic-ana\nSURFACESIGNAL_DATA_MODE=static\n"
    )
    settings = Settings.from_root(tmp_path)
    assert settings.earthdata_token.get_secret_value() == "synthetic-secret"
    assert settings.ana_api_token.get_secret_value() == "synthetic-ana"
    assert "synthetic-secret" not in repr(settings)
    assert settings.model_dump(mode="json")["earthdata_token"] != "synthetic-secret"
    assert settings.root == Path(tmp_path)
    path.unlink()
    assert Settings.from_root(tmp_path).earthdata_token is None
    with pytest.raises(ValueError):
        Settings(data_mode="invalid")


def test_clone_publish_reuses_compact_without_empty_scientific_export(tmp_path):
    from surfacesignal.delivery_cli import run_delivery_command
    from surfacesignal.storage import checksum, write_json

    base = tmp_path / "frontend/public/data/compact/api/v1"
    write_json(base / "analyses.json", {"items": [{"analysis_id": "one"}], "total": 1})
    write_json(
        base / "publication-report.json",
        {
            "analysis_count": 1,
            "delivery": {"mode": "compact"},
            "files": {"analyses.json": checksum(base / "analyses.json")},
        },
    )
    original = (base / "publication-report.json").read_bytes()
    args = parser().parse_args(["publish", "compact", "--area", "test"])
    result = run_delivery_command(Settings(root=tmp_path), args)
    assert result["analysis_count"] == 1
    assert (base / "publication-report.json").read_bytes() == original
    assert not (tmp_path / "frontend/public/data/api/v1").exists()
    args = parser().parse_args(["publish", "full", "--area", "test"])
    with pytest.raises(ValueError, match="full"):
        run_delivery_command(Settings(root=tmp_path), args)
