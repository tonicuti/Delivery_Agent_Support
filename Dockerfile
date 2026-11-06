# syntax=docker/dockerfile:1.7

# ---- builder: resolve and install locked dependencies with uv ----
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# Layer 1: third-party deps only; rebuilt only when pyproject/uv.lock change.
# README.md is required because pyproject declares readme = "README.md".
COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Layer 2: project code. The package locates the model, migrations and SQL
# seeds via Path(__file__).parents[2], so it must stay an *editable* install
# rooted at /app (uv sync does this by default) and not be copied to site-packages.
COPY src ./src
COPY migrations ./migrations
COPY schema_fresh.sql inference_seed.sql ./
COPY docker ./docker
COPY ML/data/trained_models ./ML/data/trained_models
# Only for tests/test_predictor.py (5 MB); the app itself does not read it.
COPY ML/data/training_snapshots.csv ./ML/data/training_snapshots.csv
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ---- runtime ----
FROM python:3.12-slim AS runtime

# LightGBM links against OpenMP at import time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app \
    && mkdir /data && chown app:app /data

WORKDIR /app
# Same base image + same /app path as the builder, so the venv's interpreter links stay valid.
COPY --from=builder --chown=app:app /app /app
COPY --chown=app:app tests ./tests

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DELIVERY_DB_PATH=/data/delivery_db.db \
    OLLAMA_ENDPOINT=http://ollama:11434/api/generate \
    SCHEDULER_MODE=off

USER app
VOLUME ["/data"]

ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
# Serve the planner-console API; inside compose only the frontend is published.
CMD ["serve", "--host", "0.0.0.0", "--port", "8000"]
