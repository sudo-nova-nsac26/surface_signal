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
