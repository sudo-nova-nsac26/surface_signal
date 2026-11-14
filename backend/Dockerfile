FROM python:3.12-slim
WORKDIR /app
# Rasterio's bundled GDAL needs the system Expat library at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv==0.13.6
COPY backend/pyproject.toml backend/uv.lock /app/backend/
RUN uv sync --project /app/backend --frozen --no-dev --no-install-project
COPY backend/src /app/backend/src
RUN uv sync --project /app/backend --frozen --no-dev && useradd --uid 10001 --create-home appuser
COPY config /app/config
ENV SURFACESIGNAL_ROOT=/app
ENV PATH="/app/backend/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
USER 10001
EXPOSE 8000
CMD ["uvicorn", "surfacesignal.main:app", "--host", "0.0.0.0", "--port", "8000"]
