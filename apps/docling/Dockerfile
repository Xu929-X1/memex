FROM python:3.11-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/opt/models

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libgl1 \
        libglib2.0-0 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/docling/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# Fail build loudly if chunking extra missing (HybridChunker requires it)
RUN python -c "from docling.chunking import HybridChunker; print('chunking extra OK')"

# Pre-download docling weights into HF cache so first request is fast.
# No `|| true` — fail loud if downloader API changed.
RUN python -c "from pathlib import Path; from docling.utils.model_downloader import download_models; download_models(output_dir=Path('/opt/models'))"

COPY apps/docling/process.py /app/process.py
COPY apps/docling/main.py /app/main.py

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --timeout-keep-alive 300"]
