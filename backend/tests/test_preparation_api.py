# ruff: noqa: F811
from test_pipeline_api import prepared  # noqa: F401
from test_preparation import setup

from surfacesignal.cli import main


def test_preparation_api_never_builds_and_has_typed_queries(prepared):
    from fastapi.testclient import TestClient

    from surfacesignal.main import create_app

    repo = setup(prepared)
    client = TestClient(create_app(repo.settings))
    path = "/api/v1/areas/test/preparation"
    response = client.get(path)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "preparation_not_prepared"
    assert not (prepared[-1] / "data/preparation").exists()
    assert (
        main(
            [
                "--root",
                str(prepared[-1]),
                "preparation",
                "build",
                "--area",
                "test",
                "--illustrative",
            ]
        )
        == 0
    )
    assert main(["--root", str(prepared[-1]), "preparation", "verify", "--area", "test"]) == 0
    for audience in ("residents", "municipal"):
        for lang in ("pt", "en"):
            response = client.get(path, params={"audience": audience, "lang": lang})
            assert response.status_code == 200
            value = response.json()
            assert value["audience"] == audience and value["language"] == lang
            assert value["data_status"] == "synthetic" and value["status"] == "proposed"
    assert client.get(path + "?audience=other").status_code == 422
    assert client.get(path + "?lang=fr").status_code == 422
    assert client.post(path).status_code == 405
    assert client.get("/api/v1/areas/test/local-analysis").status_code == 200
    assert client.get("/api/v1/areas/unknown/preparation").status_code == 404
    pointer = prepared[-1] / "data/preparation/test/current.json"
    pointer.write_text("{}")
    response = client.get(path)
    assert response.status_code == 503
    assert str(prepared[-1]) not in response.text


def test_opt_in_publication_matches_prepared_api_and_rejects_mismatch(prepared):
    import pytest

    from surfacesignal.preparation.store import build_preparation
    from surfacesignal.publication import build_publication
    from surfacesignal.storage import read_json

    repo = setup(prepared)
    root = prepared[-1]
    build_preparation(repo.settings, "test", illustrative=True)
    output = root / "snapshot"
    build_publication(repo.settings, "test", output, include_preparation=True)
    from fastapi.testclient import TestClient

    from surfacesignal.main import create_app

    client = TestClient(create_app(repo.settings))
    for audience in ("residents", "municipal"):
        for lang in ("pt", "en"):
            actual = read_json(output / f"areas/test/preparation.{audience}.{lang}.json")
            assert (
                actual
                == client.get(
                    f"/api/v1/areas/test/preparation?audience={audience}&lang={lang}"
                ).json()
            )
    for lang in ("pt", "en"):
        assert (
            read_json(output / f"areas/test/local-analysis.{lang}.json")
            == client.get(f"/api/v1/areas/test/local-analysis?lang={lang}").json()
        )
    assert (output / "areas/test/preparation-manifest.json").is_file()
    with pytest.raises(ValueError, match="selection"):
        build_publication(
            repo.settings,
            "test",
            root / "real-snapshot",
            exclude_synthetic=True,
            include_preparation=True,
        )
    with pytest.raises(ValueError):
        build_publication(repo.settings, "test", root / "data/preparation/nested")
    defaults = root / "default-snapshot"
    build_publication(repo.settings, "test", defaults)
    assert not (defaults / "areas/test/preparation.residents.pt.json").exists()


def test_preparation_static_url_rewrite():
    from surfacesignal.publication import _rewrite

    assert (
        _rewrite("/api/v1/areas/test/preparation?audience=municipal&lang=en")
        == "/data/api/v1/areas/test/preparation.municipal.en.json"
    )
    assert (
        _rewrite("/api/v1/areas/test/preparation")
        == "/data/api/v1/areas/test/preparation.residents.pt.json"
    )
    assert (
        _rewrite("/api/v1/areas/test/local-analysis")
        == "/data/api/v1/areas/test/local-analysis.pt.json"
    )
