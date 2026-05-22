"""PDF processor invoked by Node via spawn.

Usage: python process.py <pdf_path>
Output: JSON to stdout with shape:
{
  "sections": [{ "sectionContent": str, "codeBlocks": null, "chunkIndex": int,
                 "kind": "TEXT"|"TABLE"|"FIGURE", "pageStart": int, "pageEnd": int }],
  "fidelity": { extractedChars, afterStripChars, afterClusterChars,
                finalChunkChars, stripRetention, clusterRetention,
                chunkRetention, overallRetention }
}
Errors go to stderr with non-zero exit.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass


def _envFlag(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _envInt(name: str, default: int) -> int:
    v = os.environ.get(name)
    if v is None or not v.strip():
        return default
    try:
        return int(v.strip())
    except ValueError:
        return default


def _envStr(name: str, default: str) -> str:
    v = os.environ.get(name)
    if v is None or not v.strip():
        return default
    return v.strip()


def _resolve_layout_spec(name: str):
    from docling.datamodel.layout_model_specs import (
        DOCLING_LAYOUT_EGRET_LARGE,
        DOCLING_LAYOUT_EGRET_MEDIUM,
        DOCLING_LAYOUT_EGRET_XLARGE,
        DOCLING_LAYOUT_HERON,
        DOCLING_LAYOUT_HERON_101,
        DOCLING_LAYOUT_V2,
    )

    mapping = {
        "egret_medium": DOCLING_LAYOUT_EGRET_MEDIUM,
        "egret_large": DOCLING_LAYOUT_EGRET_LARGE,
        "egret_xlarge": DOCLING_LAYOUT_EGRET_XLARGE,
        "heron": DOCLING_LAYOUT_HERON,
        "heron_101": DOCLING_LAYOUT_HERON_101,
        "v2": DOCLING_LAYOUT_V2,
    }
    return mapping.get(name.lower(), DOCLING_LAYOUT_EGRET_MEDIUM)


def _safe_div(a: float, b: float) -> float:
    return a / b if b > 0 else 0.0


def _page_range(chunk: Any) -> tuple[int, int]:
    pages: list[int] = []
    meta = getattr(chunk, "meta", None)
    doc_items = getattr(meta, "doc_items", None) if meta else None
    if doc_items:
        for item in doc_items:
            prov = getattr(item, "prov", None) or []
            for p in prov:
                pn = getattr(p, "page_no", None)
                if isinstance(pn, int):
                    pages.append(pn)
    if not pages:
        return (0, 0)
    return (min(pages), max(pages))


def _chunk_top_y(chunk: Any) -> float:
    meta = getattr(chunk, "meta", None)
    doc_items = getattr(meta, "doc_items", None) if meta else None
    best = 0.0
    if not doc_items:
        return best
    for item in doc_items:
        prov = getattr(item, "prov", None) or []
        for p in prov:
            bbox = getattr(p, "bbox", None)
            if bbox is None:
                continue
            t = getattr(bbox, "t", None)
            if t is None:
                t = getattr(bbox, "top", None)
            if isinstance(t, (int, float)) and t > best:
                best = float(t)
    return best


def _picture_position(pic: Any) -> tuple[int | None, float]:
    prov = getattr(pic, "prov", None) or []
    if not prov:
        return (None, 0.0)
    p = prov[0]
    page = getattr(p, "page_no", None)
    bbox = getattr(p, "bbox", None)
    t = 0.0
    if bbox is not None:
        tv = getattr(bbox, "t", None) or getattr(bbox, "top", None)
        if isinstance(tv, (int, float)):
            t = float(tv)
    return (page if isinstance(page, int) else None, t)


def _picture_caption(pic: Any, doc: Any) -> str | None:
    fn = getattr(pic, "caption_text", None)
    if callable(fn):
        try:
            txt = fn(doc)
            if isinstance(txt, str) and txt.strip():
                return txt.strip()
        except Exception:
            pass
    captions = getattr(pic, "captions", None) or []
    parts: list[str] = []
    for ref in captions:
        resolved = None
        resolve = getattr(ref, "resolve", None)
        if callable(resolve):
            try:
                resolved = resolve(doc)
            except Exception:
                resolved = None
        text = getattr(resolved, "text", None) if resolved is not None else None
        if isinstance(text, str) and text.strip():
            parts.append(text.strip())
    return " ".join(parts) if parts else None


def _chunk_kind(chunk: Any) -> str:
    meta = getattr(chunk, "meta", None)
    doc_items = getattr(meta, "doc_items", None) if meta else None
    if not doc_items:
        return "TEXT"
    labels = set()
    for item in doc_items:
        label = getattr(item, "label", None)
        if label is None:
            continue
        labels.add(str(label).lower())
    if any("table" in l for l in labels):
        return "TABLE"
    if any(
        l in ("picture", "figure", "image") or "picture" in l or "figure" in l
        for l in labels
    ):
        return "FIGURE"
    return "TEXT"


def process(pdf_path: Path) -> dict:
    from docling.chunking import HybridChunker
    from docling.datamodel.accelerator_options import AcceleratorOptions
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import LayoutOptions, PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    layout_name = _envStr("DOCLING_LAYOUT_MODEL", "egret_medium")
    layout_spec = _resolve_layout_spec(layout_name)
    num_threads = _envInt("DOCLING_NUM_THREADS", 2)

    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = _envFlag("DOCLING_DO_OCR", False)
    pipeline_options.do_table_structure = _envFlag("DOCLING_DO_TABLE_STRUCTURE", True)
    pipeline_options.layout_options = LayoutOptions(model_spec=layout_spec)
    pipeline_options.accelerator_options = AcceleratorOptions(num_threads=num_threads)

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        },
    )
    result = converter.convert(str(pdf_path))
    doc = result.document

    extracted_text = doc.export_to_markdown()
    extracted_chars = len(extracted_text)

    max_tokens = _envInt("DOCLING_CHUNK_MAX_TOKENS", 512)
    chunker = HybridChunker(max_tokens=max_tokens, merge_peers=True)
    chunks = list(chunker.chunk(dl_doc=doc))

    raw_sections: list[dict] = []
    final_chars = 0
    for ch in chunks:
        text = getattr(ch, "text", None) or ""
        text = text.strip()
        if not text:
            continue
        page_start, page_end = _page_range(ch)
        sort_y = _chunk_top_y(ch)
        raw_sections.append(
            {
                "sectionContent": text,
                "codeBlocks": None,
                "kind": _chunk_kind(ch),
                "pageStart": page_start or None,
                "pageEnd": page_end or None,
                "_sortY": sort_y,
            }
        )
        final_chars += len(text)

    pictures = getattr(doc, "pictures", None) or []
    for pic in pictures:
        caption = _picture_caption(pic, doc)
        page, top_y = _picture_position(pic)
        if page is None:
            continue
        content = f"[FIGURE p{page}] {caption or '(no caption)'}"
        raw_sections.append(
            {
                "sectionContent": content,
                "codeBlocks": None,
                "kind": "FIGURE",
                "pageStart": page,
                "pageEnd": page,
                "_sortY": top_y,
            }
        )
        final_chars += len(content)

    raw_sections.sort(key=lambda s: ((s["pageStart"] or 0), -(s["_sortY"] or 0.0)))
    sections = []
    for s in raw_sections:
        s.pop("_sortY", None)
        s["chunkIndex"] = len(sections)
        sections.append(s)

    fidelity = {
        "extractedChars": extracted_chars,
        "afterStripChars": extracted_chars,
        "afterClusterChars": extracted_chars,
        "finalChunkChars": final_chars,
        "stripRetention": 1.0,
        "clusterRetention": 1.0,
        "chunkRetention": _safe_div(final_chars, extracted_chars),
        "overallRetention": _safe_div(final_chars, extracted_chars),
    }

    return {"sections": sections, "fidelity": fidelity}


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: process.py <pdf_path>", file=sys.stderr)
        return 2
    pdf_path = Path(sys.argv[1])
    if not pdf_path.is_file():
        print(f"file not found: {pdf_path}", file=sys.stderr)
        return 2
    try:
        payload = process(pdf_path)
    except Exception as e:
        print(f"docling processing failed: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
