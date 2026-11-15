"""Explicit opt-in live HTTPS smoke; never selected by default CI."""

import pytest

from surfacesignal.config import Settings
from surfacesignal.providers.public_sources import check_public_sources


@pytest.mark.external
def test_public_provider_access_without_credentials():
    report = check_public_sources(
        Settings(),
        "vale-do-taquari",
        start="2026-07-11T00:00:00Z",
        end="2026-07-23T00:00:00Z",
        max_download_bytes=2_000_000,
        max_pixels=2_000_000,
    )
    assert report["synthetic"] is False
    assert report["downloaded_bytes"] <= 2_000_000
    assert {s["source_id"] for s in report["sources"]} == {
        "chirps-v3",
        "jrc-gsw",
        "worldcover",
        "copernicus-dem",
        "ibge",
    }
    assert all(s["status"] == "accessible" for s in report["sources"]), report
