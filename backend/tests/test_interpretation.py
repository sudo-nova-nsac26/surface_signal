# ruff: noqa: F811
import pytest
from test_pipeline_api import prepared  # noqa: F401

from surfacesignal.interpretation.engine import build_story, institutional_stories
from surfacesignal.processing.capabilities import capabilities


@pytest.mark.parametrize("lang", ["pt", "en"])
def test_story_uses_measured_metrics_and_honest_status(prepared, lang):
    analysis, _, _ = prepared
    story = build_story(analysis, None, lang)
    assert story.synthetic
    assert story.data_status == "synthetic"
    assert story.validation_status == "not_validated"
    assert story.is_operational_alert is False
    assert story.general_state == "insufficient_data"
    assert story.water_state == "candidates_identified"
    assert any(m.value == analysis.statistics["candidate_area_km2"] for m in story.key_metrics)
    assert story.methodology["parameters"] == analysis.parameters
    assert len(institutional_stories(lang).items) == 12


def test_real_no_candidates_and_general_changes(prepared):
    analysis, _, _ = prepared
    real = analysis.model_copy(
        update={
            "synthetic": False,
            "statistics": {**analysis.statistics, "candidate_pixels": 0, "candidate_area_km2": 0.0},
        }
    )
    derived = {
        "algorithm": "general-change-v1",
        "derived_id": "abc",
        "parameters": {"threshold_db": 3},
        "statistics": {
            "valid_area_km2": 10.0,
            "changed_area_km2": 0.01,
            "increase_area_km2": 0.01,
            "decrease_area_km2": 0.0,
            "unchanged_area_km2": 9.99,
        },
    }
    story = build_story(real, derived, "pt")
    assert story.general_state == "small_changes"
    assert story.water_state == "no_candidates"
    assert story.data_status == "real"
    assert "ilustrativ" not in story.summary.lower()
    assert "não significa" in story.water_interpretation
    derived["statistics"]["changed_area_km2"] = 8
    assert build_story(real, derived, "en").general_state == "extensive_changes"
    derived["statistics"]["changed_area_km2"] = 0
    assert build_story(real, derived, "en").general_state == "no_candidates"


def test_capabilities_do_not_invent_thematic_measurements():
    items = {c.capability_id: c for c in capabilities()}
    assert items["general_change"].implementation_status == "implemented"
    assert items["ground_motion"].implementation_status == "unavailable"
    for key in ["vegetation", "soil_moisture", "urban"]:
        assert items[key].result_type == "explanation_only"
