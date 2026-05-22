"""FastAPI wrapper around docling pipeline.

Endpoints:
  GET  /health          liveness probe
  POST /process         multipart upload "file" (PDF). Header X-Docling-Secret required.

Auth: shared-secret header. Set DOCLING_SHARED_SECRET on both this service
and the calling web service. If unset on this service, no auth check runs
(useful for local dev only — do NOT leave unset in production).
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from process import _get_converter, process

app = FastAPI(title="memex-docling", version="1.0.0")

SECRET = os.environ.get("DOCLING_SHARED_SECRET", "").strip()


@app.on_event("startup")
def warmup() -> None:
    try:
        _get_converter()
    except Exception as e:
        print(f"warmup failed (will retry per-request): {type(e).__name__}: {e}", flush=True)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/process")
async def process_endpoint(
    file: UploadFile = File(...),
    x_docling_secret: str | None = Header(default=None),
) -> JSONResponse:
    if SECRET:
        if not x_docling_secret or x_docling_secret != SECRET:
            raise HTTPException(status_code=401, detail="invalid or missing X-Docling-Secret")

    suffix = ".pdf"
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.rsplit(".", 1)[-1].lower()

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        data = await file.read()
        tmp.write(data)
        tmp.flush()
        tmp.close()
        try:
            payload = process(Path(tmp.name))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"docling failed: {type(e).__name__}: {e}")
        return JSONResponse(payload)
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
