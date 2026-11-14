#!/usr/bin/env sh
set -eu
base="${1:-http://127.0.0.1:8000}"
for route in health api/v1/areas api/v1/scenes api/v1/analyses api/v1/sources openapi.json; do
  curl --fail --silent --show-error "$base/$route" >/dev/null
done
printf 'API smoke checks passed\n'
