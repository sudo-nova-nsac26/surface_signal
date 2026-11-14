from datetime import UTC, datetime

import pytest

from surfacesignal.domain import AreaConfig, Scene, comparable, shortlist

NAME = "NISAR_L2_PR_GCOV_025_053_D_103_4005_DHDH_A_20260711T213351_20260711T213426_P05023_N_F_J_001"


def scene(**changes):
    values = dict(
        scene_id=NAME,
        area_id="test",
        start_time="2026-07-11T21:33:51Z",
        track=53,
        frame=103,
        direction="DESCENDING",
        mode="4005",
        polarization="DHDH",
        release="P05023",
        url="https://nisar.asf.earthdatacloud.nasa.gov/a.h5",
    )
    return Scene(**(values | changes))


def test_comparable_requires_known_geometry_mode_release_and_order():
    a = scene()
    b = scene(scene_id=NAME + "b", start_time="2026-07-23T21:33:50Z")
    assert comparable(a, b)
    for changes in [
        dict(track=103),
        dict(frame=163),
        dict(direction="ASCENDING"),
        dict(mode=None),
        dict(release="P05036"),
        dict(polarization="DVDV"),
    ]:
        assert not comparable(a, b.model_copy(update=changes))
    assert not comparable(b, a)


def test_shortlist_brackets_event_and_never_crosses_tracks():
    a = scene()
    b = scene(scene_id="later", start_time="2026-07-23T21:33:50Z")
    c = scene(scene_id="other", track=103, start_time="2026-07-23T21:33:50Z")
    pairs = shortlist([c, b, a], datetime(2026, 7, 23, tzinfo=UTC))
    assert [(p["before"], p["after"]) for p in pairs] == [(a.scene_id, b.scene_id)]


def test_area_requires_valid_polygon_and_provenance():
    with pytest.raises(ValueError):
        AreaConfig(
            area_id="x",
            name="X",
            geometry={"type": "Point", "coordinates": [0, 0]},
            source_url="https://example.org",
        )
