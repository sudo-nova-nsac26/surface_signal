# ruff: noqa: F811

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from test_pipeline_api import prepared  # noqa: F401, F811

from surfacesignal.processing.general_change import derive_analysis, load_derived
from surfacesignal.storage import checksum, read_json, write_json


def replace_delta(prepared, values, crs="EPSG:32722"):
    analysis, _, root = prepared
    directory = root / "artifacts" / analysis.analysis_id
    path = directory / "delta-db.tif"
    values = np.asarray(values, dtype="float32")
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=values.shape[1],
        height=values.shape[0],
        count=1,
        dtype="float32",
        crs=crs,
        transform=from_origin(400000, 6750000, 20, 20),
        nodata=-9999,
    ) as dst:
        dst.write(values, 1)
    manifest = read_json(directory / "manifest.json")
    manifest["artifacts"]["delta-db.tif"] = checksum(path)
    write_json(directory / "manifest.json", manifest)
    return root, analysis.analysis_id


def test_thresholds_accounting_and_provenance(prepared):
    root, aid = replace_delta(prepared, [[3, 4, 0, -3], [3, np.nan, -1, -4], [0, -9999, 2.9, 3]])
    result = derive_analysis(root, aid, min_component_pixels=2)
    s = result["statistics"]
    assert s["valid_pixels"] == 10 and s["invalid_pixels"] == 2
    assert s["increase_pixels"] == 3 and s["decrease_pixels"] == 2
    assert s["discarded_pixels"] == 1 and s["below_threshold_pixels"] == 4
    assert s["changed_pixels"] + s["unchanged_pixels"] == s["valid_pixels"]
    assert s["changed_area_km2"] == 5 * 400 / 1e6
    assert s["discarded_components"] == 1
    assert result == derive_analysis(root, aid, min_component_pixels=2)
    assert result == load_derived(root, aid, verify=True)
    path = root / "data/derived" / aid / result["derived_id"]
    geo = read_json(path / "general-change.geojson")
    assert [f["properties"]["class"] for f in geo["features"]] == [
        "radar_increase",
        "radar_decrease",
    ]
    assert sum(f["properties"]["pixels"] for f in geo["features"]) == 5
    assert -180 < geo["features"][0]["geometry"]["coordinates"][0][0][0] < 180
    assert read_json(path / "general-evidence.json")["synthetic"] is True
    (path / "general-statistics.json").write_text("{}")
    with pytest.raises(ValueError):
        load_derived(root, aid, verify=True)
    with pytest.raises(ValueError):
        derive_analysis(root, aid, min_component_pixels=2)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"threshold_db": 0},
        {"threshold_db": float("nan")},
        {"threshold_db": -3},
        {"min_component_pixels": 0},
        {"min_component_pixels": 1.5},
        {"max_pixels": 1},
    ],
)
def test_invalid_parameters_and_budget(prepared, kwargs):
    analysis, _, root = prepared
    with pytest.raises(ValueError):
        derive_analysis(root, analysis.analysis_id, **kwargs)


def test_four_neighbors_empty_and_crs(prepared):
    root, aid = replace_delta(prepared, [[3, 0], [0, 3]])
    result = derive_analysis(root, aid, min_component_pixels=2)
    assert result["statistics"]["changed_pixels"] == 0
    assert result["statistics"]["discarded_components"] == 2
    replace_delta(prepared, [[np.nan, -9999]])
    result = derive_analysis(root, aid)
    assert result["statistics"]["mean_delta_db"] is None
    assert result["statistics"]["changed_percent"] is None
    replace_delta(prepared, [[3]], "EPSG:4326")
    with pytest.raises(ValueError, match="metre"):
        derive_analysis(root, aid)


def test_symlink_and_read_does_not_hash_tiff(prepared, monkeypatch):
    analysis, _, root = prepared
    result = derive_analysis(root, analysis.analysis_id, min_component_pixels=1)
    import surfacesignal.processing.general_change as module

    original = module.checksum

    def guarded(path):
        assert path.suffix not in {".tif", ".h5"}
        return original(path)

    monkeypatch.setattr(module, "checksum", guarded)
    assert load_derived(root, analysis.analysis_id, verify=True) == result
    folder = root / "data/derived" / analysis.analysis_id / result["derived_id"]
    target = folder / "general-change.geojson"
    target.unlink()
    target.symlink_to(root / "artifacts" / analysis.analysis_id / "change-candidates.geojson")
    with pytest.raises(ValueError):
        load_derived(root, analysis.analysis_id)
    assert load_derived(root, "missing") is None


def test_default_filter_historical_outputs_and_safe_getter(prepared):
    from surfacesignal.processing.general_change import derived_artifact_path

    root, aid = replace_delta(prepared, [[3] * 3] * 3)
    first = derive_analysis(root, aid)
    assert first["statistics"]["increase_pixels"] == 9
    first_folder = root / "data/derived" / aid / first["derived_id"]
    first_payload = (first_folder / "manifest.json").read_bytes()
    second = derive_analysis(root, aid, threshold_db=4)
    assert first["derived_id"] != second["derived_id"]
    assert (first_folder / "manifest.json").read_bytes() == first_payload
    assert (
        derived_artifact_path(root, aid, "general-change.geojson").parent.name
        == second["derived_id"]
    )
    with pytest.raises(ValueError):
        derived_artifact_path(root, aid, "../secret")
    with pytest.raises(FileNotFoundError):
        derived_artifact_path(root, "missing", "manifest.json")
    with pytest.raises(ValueError):
        derive_analysis(root, "../escape")


def test_original_corruption_and_symlink_ancestors(prepared):
    analysis, _, root = prepared
    folder = root / "artifacts" / analysis.analysis_id
    (folder / "statistics.json").write_text("{}")
    with pytest.raises(ValueError):
        derive_analysis(root, analysis.analysis_id)
    (root / "data").symlink_to(root / "artifacts", target_is_directory=True)
    with pytest.raises(ValueError):
        load_derived(root, analysis.analysis_id)


def test_public_flat_statistics_have_neutral_classification(prepared):
    root, aid = replace_delta(prepared, [[3, 4, 0, -3]])
    stats = derive_analysis(root, aid, min_component_pixels=1)["statistics"]
    assert stats["classification"] == "radar_backscatter_change"
    assert stats["validation_status"] == "not_validated"
    assert stats["min_delta_db"] == -3
    assert stats["max_delta_db"] == 4
    assert stats["median_delta_db"] == 1.5
    assert stats["positive_change_percent"] == 50
    assert stats["negative_change_percent"] == 25
