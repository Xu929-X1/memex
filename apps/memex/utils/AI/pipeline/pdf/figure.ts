import type { BBox, PdfBlock, PdfImageRef, PdfItem, PdfPage } from "./types";

const CAPTION_RE = /^(fig(?:ure)?|table)\.?\s*\d+/i;
const CAPTION_MAX_DISTANCE = 40;
const ITEM_INSIDE_PADDING = 4;

function itemCenter(item: PdfItem): { x: number; y: number } {
    return { x: item.x + item.w / 2, y: item.y + item.h / 2 };
}

function itemInsideBBox(item: PdfItem, bbox: BBox): boolean {
    const c = itemCenter(item);
    return (
        c.x >= bbox.x - ITEM_INSIDE_PADDING &&
        c.x <= bbox.x + bbox.w + ITEM_INSIDE_PADDING &&
        c.y >= bbox.y - ITEM_INSIDE_PADDING &&
        c.y <= bbox.y + bbox.h + ITEM_INSIDE_PADDING
    );
}

function findCaption(ref: PdfImageRef, items: PdfItem[]): string | null {
    const bboxBottom = ref.bbox.y;
    const bboxCenterX = ref.bbox.x + ref.bbox.w / 2;
    const candidates = items
        .filter(it => {
            if (it.page !== ref.page) return false;
            const trimmed = it.str.trim();
            if (!trimmed) return false;
            const distanceBelow = bboxBottom - it.y;
            if (distanceBelow < 0 || distanceBelow > CAPTION_MAX_DISTANCE) return false;
            const center = it.x + it.w / 2;
            return Math.abs(center - bboxCenterX) < Math.max(ref.bbox.w, 200);
        })
        .sort((a, b) => bboxBottom - a.y - (bboxBottom - b.y));
    if (candidates.length === 0) return null;
    const firstY = candidates[0].y;
    const sameLine = candidates.filter(c => Math.abs(c.y - firstY) <= 2).sort((a, b) => a.x - b.x);
    const text = sameLine.map(c => c.str).join(" ").replace(/\s+/g, " ").trim();
    if (CAPTION_RE.test(text)) return text;
    return text.length > 0 ? text : null;
}

export interface FigureDetectionResult {
    figures: Array<PdfBlock & { kind: "FIGURE" }>;
    consumedCaptionItems: Set<PdfItem>;
}

export function detectFigures(pages: PdfPage[]): FigureDetectionResult {
    const figures: FigureDetectionResult["figures"] = [];
    const consumedCaptionItems = new Set<PdfItem>();
    for (const p of pages) {
        for (const ref of p.imageRefs) {
            const caption = findCaption(ref, p.items);
            figures.push({
                kind: "FIGURE",
                page: ref.page,
                caption,
                bbox: ref.bbox,
            });
            if (caption) {
                for (const item of p.items) {
                    if (item.page !== ref.page) continue;
                    if (caption.includes(item.str.trim()) && item.str.trim().length > 0) {
                        const distanceBelow = ref.bbox.y - item.y;
                        if (distanceBelow >= 0 && distanceBelow <= CAPTION_MAX_DISTANCE) {
                            consumedCaptionItems.add(item);
                        }
                    }
                    if (itemInsideBBox(item, ref.bbox)) consumedCaptionItems.add(item);
                }
            } else {
                for (const item of p.items) {
                    if (item.page !== ref.page) continue;
                    if (itemInsideBBox(item, ref.bbox)) consumedCaptionItems.add(item);
                }
            }
        }
    }
    return { figures, consumedCaptionItems };
}
