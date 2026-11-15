"""Strictly bounded public HTTPS byte ranges for offline raster acquisition.

GDAL receives only a seekable Python reader: no unmetered /vsicurl requests.
Each acquired range is hashed; a remote ETag pins subsequent requests.
"""

import hashlib
import io
import re
from urllib.parse import urlsplit

import httpx

HOSTS = {
    "data.chc.ucsb.edu",
    "esa-worldcover.s3.eu-central-1.amazonaws.com",
    "copernicus-dem-30m.s3.amazonaws.com",
    "s3.waw4-1.cloudferro.com",
    "servicodados.ibge.gov.br",
}


def checked_url(url):
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in HOSTS
        or parsed.username
        or parsed.password
        or parsed.fragment
        or parsed.port not in (None, 443)
    ):
        raise ValueError("Only registered public HTTPS endpoints are permitted")
    return url


class DownloadBudget:
    def __init__(self, max_bytes, *, max_requests=5000):
        if isinstance(max_bytes, bool) or not 1 <= max_bytes <= 500_000_000:
            raise ValueError("Download budget must be 1..500000000 bytes")
        self.maximum = max_bytes
        self.used = 0
        self.requests = 0
        self.max_requests = max_requests

    def reserve(self, count):
        if count < 0 or self.used + count > self.maximum:
            raise ValueError("Public source download byte budget exceeded before request")
        if self.requests >= self.max_requests:
            raise ValueError("Public source request budget exceeded")
        self.requests += 1


def get_bytes(client, url, budget, *, limit, headers=None, params=None):
    checked_url(url)
    limit = min(limit, budget.maximum - budget.used)
    if limit < 1:
        raise ValueError("Public source download byte budget exhausted")
    budget.reserve(limit)
    with client.stream(
        "GET", url, headers=headers, params=params, follow_redirects=False
    ) as response:
        response.raise_for_status()
        length = response.headers.get("content-length")
        if length is not None and int(length) > limit:
            raise ValueError("Public source response exceeds byte budget before body read")
        raw = bytearray()
        for chunk in response.iter_bytes(chunk_size=min(limit + 1, 65536)):
            # Charge all received bytes even on a rejected response.
            budget.used += len(chunk)
            if len(raw) + len(chunk) > limit or budget.used > budget.maximum:
                raise ValueError("Public source response byte budget exceeded")
            raw.extend(chunk)
        return bytes(raw), dict(response.headers), response.status_code


class PublicRangeReader(io.RawIOBase):
    block_size = 65536

    def __init__(self, client, url, budget):
        super().__init__()
        self.client, self.url, self.budget = client, checked_url(url), budget
        self.position = 0
        self.size = None
        self.etag = None
        self.last_modified = None
        self.cache = {}
        self.ranges = []
        self._range(0, 8191)

    def _range(self, start, end):
        if self.size is not None:
            end = min(end, self.size - 1)
        count = end - start + 1
        self.budget.reserve(count)
        headers = {"Range": f"bytes={start}-{end}", "Accept-Encoding": "identity"}
        if self.etag:
            headers["If-Match"] = self.etag
        with self.client.stream(
            "GET", self.url, headers=headers, follow_redirects=False
        ) as response:
            response.raise_for_status()
            match = re.fullmatch(
                r"bytes (\d+)-(\d+)/(\d+)", response.headers.get("content-range", "")
            )
            if response.status_code != 206 or not match:
                raise ValueError("Server must honor bounded HTTPS byte ranges")
            first, last, size = map(int, match.groups())
            if first != start or last != min(end, size - 1) or size < 1:
                raise ValueError("Unexpected public source byte range")
            if self.size is not None and size != self.size:
                raise ValueError("Remote source changed during acquisition")
            if self.etag and response.headers.get("etag") != self.etag:
                raise ValueError("Remote source ETag changed during acquisition")
            self.size = size
            self.etag = response.headers.get("etag")
            self.last_modified = response.headers.get("last-modified")
            expected = last - first + 1
            raw = bytearray()
            for chunk in response.iter_bytes(chunk_size=min(expected + 1, 65536)):
                self.budget.used += len(chunk)
                if len(raw) + len(chunk) > expected or self.budget.used > self.budget.maximum:
                    raise ValueError("Public source byte range budget exceeded")
                raw.extend(chunk)
            if len(raw) != expected:
                raise ValueError("Truncated public source byte range")
            self.ranges.append(
                {"start": first, "end": last, "sha256": hashlib.sha256(raw).hexdigest()}
            )
            return bytes(raw)

    def read(self, size=-1):
        if size < 0:
            size = self.size - self.position
        size = min(size, self.size - self.position)
        if size <= 0:
            return b""
        if size > self.budget.maximum - self.budget.used:
            raise ValueError("Raster read exceeds remaining download budget before allocation")
        pieces = []
        while size:
            block = self.position // self.block_size
            begin = block * self.block_size
            if block not in self.cache:
                self.cache[block] = self._range(begin, begin + self.block_size - 1)
            offset = self.position - begin
            part = self.cache[block][offset : offset + size]
            if not part:
                break
            pieces.append(part)
            self.position += len(part)
            size -= len(part)
        return b"".join(pieces)

    def seek(self, offset, whence=0):
        position = (
            offset if whence == 0 else self.position + offset if whence == 1 else self.size + offset
        )
        if position < 0:
            raise ValueError("Negative remote seek")
        self.position = position
        return position

    def tell(self):
        return self.position

    def readable(self):
        return True

    def seekable(self):
        return True

    def evidence(self):
        return {
            "url": self.url,
            "object_bytes": self.size,
            "etag": self.etag,
            "last_modified": self.last_modified,
            "acquired_ranges": self.ranges,
        }


def public_client():
    return httpx.Client(timeout=30, follow_redirects=False, trust_env=False)
