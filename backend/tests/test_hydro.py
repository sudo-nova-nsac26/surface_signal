from datetime import UTC, datetime

import pytest

from surfacesignal.providers.hydro import context_for, read_records, reference_status


def test_csv_requires_source_time_and_preserves_missing_level(tmp_path):
    p = tmp_path / "levels.csv"
    p.write_text(
        "station,observed_at,level_m,source_url,note\nLajeado,2026-07-23T19:00:00Z,,https://www.sgb.gov.br/example,above flood threshold\n"
    )
    records = read_records(p)
    c = context_for(records, datetime(2026, 7, 23, 21, 33, 50, tzinfo=UTC))
    assert c[0]["time_offset_hours"] == pytest.approx(-2.5638888889)
    assert c[0]["level_m"] is None and c[0]["role"] == "hydrological_context_not_spatial_validation"
    p.write_text("station,observed_at,level_m,source_url,note\nLajeado,2026-07-23,24,,bad\n")
    with pytest.raises(ValueError):
        read_records(p)


def test_reference_time_policy_never_claims_ground_truth():
    assert reference_status(None, 0)["validation_status"] == "not_validated"
    assert reference_status("https://example.org", 100)["validation_status"] == "context_only"
    assert (
        reference_status("https://example.org", 2)["validation_status"] == "eligible_for_comparison"
    )
