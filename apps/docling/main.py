"""FastAPI wrapper around docling pipeline.

Endpoints:
  GET  /health          liveness probe
  POST /process         multipart upload "file" (PDF). Header X-Docling-Secret required.

Auth: shared-secret header. Set DOCLING_SHARED_SECRET on both this service
and the calling web service. If unset on this service, no auth check runs
(useful for local dev only — do NOT leave unset in production).
"""

from __future__ import annotations

import logging
import os
import sys
import tempfile
import time
import traceback
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from process import _get_converter, process

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("docling.api")

app = FastAPI(title="memex-docling", version="1.0.0")

SECRET = os.environ.get("DOCLING_SHARED_SECRET", "").strip()


@app.on_event("startup")
def warmup() -> None:
    log.info("startup: warming up converter (secret_required=%s)", bool(SECRET))
    t0 = time.perf_counter()
    try:
        _get_converter()
        log.info("startup: converter ready in %.2fs", time.perf_counter() - t0)
    except Exception as e:
        log.error(
            "startup: warmup failed (will retry per-request): %s: %s\n%s",
            type(e).__name__,
            e,
            traceback.format_exc(),
        )


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/process")
async def process_endpoint(
    file: UploadFile = File(...),
    x_docling_secret: str | None = Header(default=None),
    x_trace_id: str | None = Header(default=None),
) -> JSONResponse:
    trace_id = x_trace_id or uuid.uuid4().hex[:12]
    t_start = time.perf_counter()

    if SECRET:
        if not x_docling_secret or x_docling_secret != SECRET:
            log.warning("[%s] /process auth failed (header_present=%s)", trace_id, bool(x_docling_secret))
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
        log.info(
            "[%s] /process start filename=%r size=%dB suffix=%s",
            trace_id,
            file.filename,
            len(data),
            suffix,
        )
        try:
            t_proc = time.perf_counter()
            payload = process(Path(tmp.name))
            proc_ms = (time.perf_counter() - t_proc) * 1000
        except Exception as e:
            log.error(
                "[%s] /process failed: %s: %s\n%s",
                trace_id,
                type(e).__name__,
                e,
                traceback.format_exc(),
            )
            raise HTTPException(status_code=500, detail=f"docling failed: {type(e).__name__}: {e}")

        sections = payload.get("sections", [])
        fidelity = payload.get("fidelity", {})
        log.info(
            "[%s] /process ok sections=%d extractedChars=%s finalChars=%s overallRetention=%.3f proc_ms=%.0f total_ms=%.0f",
            trace_id,
            len(sections),
            fidelity.get("extractedChars"),
            fidelity.get("finalChunkChars"),
            float(fidelity.get("overallRetention", 0.0)),
            proc_ms,
            (time.perf_counter() - t_start) * 1000,
        )
        return JSONResponse(payload, headers={"X-Trace-Id": trace_id})
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
