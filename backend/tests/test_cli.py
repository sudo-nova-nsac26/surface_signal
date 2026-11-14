import json

from surfacesignal.cli import main
from surfacesignal.storage import write_json


def test_cli_healthful_help_and_snapshot_import(tmp_path, capfd):
    snapshot = tmp_path / "snapshot.json"
    write_json(snapshot, {"area_id": "test", "scenes": [], "query": {}})
    assert main(["--root", str(tmp_path), "scenes", "import", "--file", str(snapshot)]) == 0
    assert json.loads((tmp_path / "data/catalog/test.json").read_text())["scenes"] == []
    assert main(["--root", str(tmp_path), "scenes", "inspect", "--scene-id", "missing"]) == 2
    assert "not found" in capfd.readouterr().err
