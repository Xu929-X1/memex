FROM python:3.11-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/opt/models \
    DOCLING_ARTIFACTS_PATH=/opt/models

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libgl1 \
        libglib2.0-0 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/docling/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# Pre-download docling weights into the image so first request is fast
RUN python -c "from docling.utils.model_downloader import download_models; download_models(output_dir='/opt/models')" || \
    python -c "from docling.document_converter import DocumentConverter; DocumentConverter()" || true

COPY apps/docling/process.py /app/process.py
COPY apps/docling/main.py /app/main.py

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --timeout-keep-alive 300"]
