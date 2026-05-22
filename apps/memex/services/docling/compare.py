"""Compare chunked JSON sections against full Docling markdown export.

Usage: python compare.py <pdf_path> <sections_json_path>
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _ngrams(text: str, n: int = 5) -> set[str]:
    toks = _normalize(text).split()
    return {" ".join(toks[i:i + n]) for i in range(len(toks) - n + 1)} if len(toks) >= n else set()


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: compare.py <pdf_path> <sections_json>", file=sys.stderr)
        return 2
    pdf_path = Path(sys.argv[1])
    json_path = Path(sys.argv[2])

    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = False
    pipeline_options.do_table_structure = True
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)},
    )
    print(f"[1/3] Converting PDF...", file=sys.stderr)
    result = converter.convert(str(pdf_path))
    doc = result.document
    md = doc.export_to_markdown()
    md_norm = _normalize(md)
    md_chars = len(md)
    md_norm_chars = len(md_norm)

    print(f"[2/3] Loading JSON sections...", file=sys.stderr)
    with json_path.open("r", encoding="utf-8") as f:
        rows = json.load(f)
    rows.sort(key=lambda r: r.get("chunkIndex", 0))

    sec_concat = " ".join(r["sectionContent"] for r in rows)
    sec_norm = _normalize(sec_concat)
    sec_chars = sum(len(r["sectionContent"]) for r in rows)
    sec_norm_chars = len(sec_norm)

    print(f"[3/3] Computing metrics...", file=sys.stderr)
    md_grams = _ngrams(md, 5)
    sec_grams = _ngrams(sec_concat, 5)
    common = md_grams & sec_grams
    md_coverage = len(common) / len(md_grams) if md_grams else 0.0
    sec_precision = len(common) / len(sec_grams) if sec_grams else 0.0

    # Mid-sentence chunks
    sentence_end = re.compile(r"[.!?。？！…\"')\]]\s*$")
    sentence_start = re.compile(r"^[A-Z\(\[\"“‘0-9一-龥]")
    mid_sentence = 0
    for r in rows:
        s = r["sectionContent"].strip()
        if not s:
            continue
        if not sentence_end.search(s):
            mid_sentence += 1
    tiny = sum(1 for r in rows if len(r["sectionContent"]) < 100)
    huge = sum(1 for r in rows if len(r["sectionContent"]) > 2000)

    # Order check: pageStart monotonic non-decreasing?
    page_inversions = 0
    last_p = 0
    for r in rows:
        p = r.get("pageStart") or 0
        if p < last_p:
            page_inversions += 1
        last_p = max(last_p, p)

    # Kind distribution
    kinds: dict[str, int] = {}
    for r in rows:
        k = r.get("kind") or "NONE"
        kinds[k] = kinds.get(k, 0) + 1

    # Size stats
    lens = [len(r["sectionContent"]) for r in rows]
    lens.sort()
    n = len(lens)
    p5 = lens[int(n * 0.05)] if n else 0
    p50 = lens[int(n * 0.50)] if n else 0
    p95 = lens[int(n * 0.95)] if n else 0

    report = {
        "pdf": str(pdf_path),
        "json": str(json_path),
        "doclingMarkdownChars": md_chars,
        "sectionsTotalChars": sec_chars,
        "charRetentionVsMarkdown": round(sec_norm_chars / max(md_norm_chars, 1), 4),
        "sectionCount": len(rows),
        "kinds": kinds,
        "sizeP5": p5,
        "sizeP50": p50,
        "sizeP95": p95,
        "tinyCount_lt100": tiny,
        "hugeCount_gt2000": huge,
        "midSentenceCount": mid_sentence,
        "midSentenceRate": round(mid_sentence / max(len(rows), 1), 3),
        "pageInversions": page_inversions,
        "ngramCoverageOfMarkdown": round(md_coverage, 4),
        "ngramPrecisionVsMarkdown": round(sec_precision, 4),
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
