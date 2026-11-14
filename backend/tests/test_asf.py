import pytest
import requests
from test_domain import NAME, scene

from surfacesignal.providers.asf import ProviderError, download, map_feature, search


def feature(name=NAME):
    return {
        "type": "Feature",
        "geometry": None,
        "properties": {
            "sceneName": name,
            "startTime": "2026-07-11T21:33:51Z",
            "pathNumber": 53,
            "frameNumber": 103,
            "flightDirection": "DESCENDING",
            "url": "https://nisar.asf.earthdatacloud.nasa.gov/" + name + ".h5",
            "bytes": {name + ".h5": {"bytes": 1234, "format": "HDF5"}},
            "crid": "P05023",
        },
    }


def test_mapping_nested_bytes_and_filename_fields():
    s = map_feature(feature(), "test", "PROVISIONAL")
    assert s.size_bytes == 1234 and s.mode == "4005" and s.polarization == "DHDH"
    assert s.maturity == "PROVISIONAL" and s.metadata["maturity_basis"] == "query_filter"
    f = feature()
    f["properties"]["bytes"] = {}
    assert map_feature(f, "test", "PROVISIONAL").size_bytes is None


def test_search_consumes_pages_and_retries_without_duplicates():
    count = 0

    class Page:
        def geojson(self):
            return {"features": [feature()]}

    def pages(**kwargs):
        nonlocal count
        assert kwargs["dataset"] == "NISAR" and kwargs["processingLevel"] == "GCOV"
        assert kwargs["dataMaturity"] == "PROVISIONAL" and "maxResults" not in kwargs
        count += 1
        yield Page()
        if count == 1:
            raise requests.Timeout("secret-looking text should not escape")
        yield Page()

    found = search(
        "POINT(-51 -29)", "2026-07-01", "2026-08-01", "test", generator=pages, sleep=lambda _: None
    )
    assert len(found) == 1


def test_validated_search_uses_short_name_and_preserves_collection():
    class Page:
        def geojson(self):
            return {"features": [feature()]}

    def pages(**kwargs):
        assert kwargs["shortName"] == "NISAR_L2_GCOV_V1"
        assert "dataMaturity" not in kwargs and "dataset" not in kwargs
        yield Page()
        yield Page()

    found = search(
        "POINT(0 0)",
        "2026-06-17",
        "2026-11-14",
        "test",
        short_name="NISAR_L2_GCOV_V1",
        generator=pages,
    )
    assert len(found) == 1 and found[0].maturity == "VALIDATED"
    assert found[0].metadata["collection"] == "NISAR_L2_GCOV_V1"


def test_empty_and_cap_and_auth_error():
    assert (
        search("POINT(0 0)", "2026-01-01", "2026-02-01", "test", generator=lambda **k: iter([]))
        == []
    )

    def denied(**kwargs):
        response = requests.Response()
        response.status_code = 403
        raise requests.HTTPError("sensitive", response=response)

    with pytest.raises(ProviderError, match="403"):
        search("POINT(0 0)", "2026-01-01", "2026-02-01", "test", generator=denied)


def test_download_refuses_unknown_size_or_untrusted_host(tmp_path):
    with pytest.raises(ValueError, match="size"):
        download(scene(), tmp_path, 1)
    with pytest.raises(ValueError, match="host"):
        download(scene(size_bytes=10, url="http://127.0.0.1/secret"), tmp_path, 1)


def test_catalog_safety_cap_never_returns_partial():
    class Page:
        def geojson(self):
            return {"features": [feature(), feature(NAME + "x")]}

    with pytest.raises(ProviderError, match="safety limit"):
        search(
            "POINT(0 0)",
            "2026-01-01",
            "2026-02-01",
            "test",
            generator=lambda **k: iter([Page()]),
            limit=1,
        )


@pytest.mark.parametrize("status", [401, 403])
def test_catalog_auth_not_retried(status):
    calls = []

    def denied(**kwargs):
        calls.append(1)
        response = requests.Response()
        response.status_code = status
        raise requests.HTTPError("SECRET", response=response)

    with pytest.raises(ProviderError) as error:
        search("POINT(0 0)", "2026-01-01", "2026-02-01", "test", generator=denied)
    assert "SECRET" not in str(error.value) and len(calls) == 1


def test_catalog_timeout_exhaustion_sanitized():
    def timeout(**kwargs):
        raise requests.Timeout("SECRET")

    with pytest.raises(ProviderError, match="3 attempts") as error:
        search(
            "POINT(0 0)",
            "2026-01-01",
            "2026-02-01",
            "test",
            generator=timeout,
            sleep=lambda _: None,
        )
    assert "SECRET" not in str(error.value)


def test_download_size_budget_and_disk_guard(tmp_path, monkeypatch):
    from collections import namedtuple

    import surfacesignal.providers.asf as provider

    with pytest.raises(ValueError, match="budget"):
        download(scene(size_bytes=2_000_000_000), tmp_path, 1)
    usage = namedtuple("usage", "total used free")
    monkeypatch.setattr(provider.shutil, "disk_usage", lambda _: usage(100, 99, 1))
    with pytest.raises(ValueError, match="disk"):
        download(scene(size_bytes=10), tmp_path, 1)


def test_download_incomplete_cleanup_and_success_receipt(tmp_path, monkeypatch):
    import h5py

    from surfacesignal.storage import read_json

    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    source = tmp_path / "source.h5"
    with h5py.File(source, "w") as h:
        h.create_dataset("test", data=[1, 2])
    payload = source.read_bytes()

    class Response:
        headers = {}

        def __init__(self, content):
            self.content = content

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, size):
            yield self.content

    class Session:
        def __init__(self, content):
            self.content = content

        def get(self, *args, **kwargs):
            return Response(self.content)

    s = scene(size_bytes=len(payload))
    directory = tmp_path / "raw"
    with pytest.raises(ValueError, match="Incomplete"):
        download(s, directory, 1, session=Session(payload[:20]))
    assert not list(directory.glob("*.part")) and not list(directory.glob("*.h5"))
    target = download(s, directory, 1, session=Session(payload))
    assert target.read_bytes() == payload and read_json(target.with_suffix(".receipt.json"))[
        "size_bytes"
    ] == len(payload)
    assert download(s, directory, 1, session=Session(b"")) == target
    target.write_bytes(b"bad")
    with pytest.raises(ValueError, match="receipt/checksum"):
        download(s, directory, 1, session=Session(payload))


@pytest.mark.parametrize("budget", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_download_budget_rejected_before_io(tmp_path, budget):
    class NoNetwork:
        def get(self, *args, **kwargs):
            raise AssertionError("Invalid budget reached network")

    with pytest.raises(ValueError, match="finite"):
        download(scene(size_bytes=10), tmp_path, budget, session=NoNetwork())


class DownloadSession:
    def __init__(self, payload, failures=()):
        self.payload = payload
        self.failures = list(failures)
        self.calls = 0

    def get(self, *args, **kwargs):
        self.calls += 1
        if self.failures:
            raise self.failures.pop(0)
        payload = self.payload

        class Response:
            headers = {"Content-Length": str(len(payload))}

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def raise_for_status(self):
                pass

            def iter_content(self, size):
                yield payload[:10]
                yield payload[10:]

        return Response()


def test_download_recovers_interrupt_between_receipt_and_publish(tmp_path, gcov, monkeypatch):
    import surfacesignal.providers.asf as provider

    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    payload = gcov.read_bytes()
    s = scene(size_bytes=len(payload))
    original = provider.os.replace

    def interrupt(source, target):
        if str(target).endswith(".h5"):
            raise KeyboardInterrupt
        return original(source, target)

    monkeypatch.setattr(provider.os, "replace", interrupt)
    raw = tmp_path / "raw"
    with pytest.raises(KeyboardInterrupt):
        download(s, raw, 1, session=DownloadSession(payload))
    assert list(raw.glob("*.receipt.json")) and list(raw.glob("*.part"))
    assert not list(raw.glob("*.h5"))
    monkeypatch.setattr(provider.os, "replace", original)
    session = DownloadSession(b"")
    target = download(s, raw, 1, session=session)
    assert target.read_bytes() == payload and session.calls == 0


def test_download_interrupt_before_receipt_never_leaves_unrecoverable_final(
    tmp_path, gcov, monkeypatch
):
    import surfacesignal.providers.asf as provider

    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    payload = gcov.read_bytes()

    def interrupt(*args, **kwargs):
        raise KeyboardInterrupt

    monkeypatch.setattr(provider, "write_json", interrupt)
    with pytest.raises(KeyboardInterrupt):
        download(
            scene(size_bytes=len(payload)), tmp_path / "raw", 1, session=DownloadSession(payload)
        )
    assert not list((tmp_path / "raw").glob("*.h5"))


def test_download_retries_transient_errors_and_reports_progress(tmp_path, gcov, monkeypatch):
    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    payload = gcov.read_bytes()
    session = DownloadSession(payload, [requests.Timeout("SECRET")])
    progress = []
    download(
        scene(size_bytes=len(payload)),
        tmp_path / "raw",
        1,
        session=session,
        sleep=lambda _: None,
        progress=lambda count, total: progress.append((count, total)),
    )
    assert session.calls == 2 and progress[-1] == (len(payload), len(payload))


@pytest.mark.parametrize("status", [401, 403])
def test_download_auth_error_is_immediate_and_actionable(tmp_path, gcov, monkeypatch, status):
    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    response = requests.Response()
    response.status_code = status
    session = DownloadSession(gcov.read_bytes(), [requests.HTTPError("SECRET", response=response)])
    with pytest.raises(ProviderError, match=str(status)) as error:
        download(
            scene(size_bytes=gcov.stat().st_size),
            tmp_path / "raw",
            1,
            session=session,
            sleep=lambda _: None,
        )
    assert session.calls == 1 and "SECRET" not in str(error.value)
    assert "Earthdata" in str(error.value)


def test_receipt_is_bound_to_scene_size_and_url(tmp_path, gcov, monkeypatch):
    import surfacesignal.providers.asf as provider
    from surfacesignal.storage import read_json, write_json

    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    s = scene(size_bytes=gcov.stat().st_size)
    target = download(s, tmp_path / "raw", 1, session=DownloadSession(gcov.read_bytes()))
    receipt = target.with_suffix(".receipt.json")
    value = read_json(receipt)
    value["scene_id"] = "another"
    write_json(receipt, value)
    with pytest.raises(ValueError, match="receipt"):
        provider.verify_download(s, tmp_path / "raw")
    original = target.read_bytes()
    with pytest.raises(ValueError, match="receipt"):
        download(s, tmp_path / "raw", 1, session=DownloadSession(b""))
    assert target.read_bytes() == original


def test_persistent_non_hdf5_response_retried_and_never_published(tmp_path, monkeypatch):
    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    session = DownloadSession(b"authentication page")
    with pytest.raises(ValueError, match="not HDF5.*3 attempts"):
        download(
            scene(size_bytes=len(session.payload)),
            tmp_path / "raw",
            1,
            session=session,
            sleep=lambda _: None,
        )
    assert session.calls == 3
    assert not list((tmp_path / "raw").glob("*.h5"))
    assert not list((tmp_path / "raw").glob("*.receipt.json"))
