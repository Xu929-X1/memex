import type { PdfItem, PdfPage } from "./types";

const TOP_BAND = 0.92;
const BOT_BAND = 0.08;
const REPEAT_RATIO = 0.6;
const PAGE_NUMBER_RE = /^\s*(?:page\s+)?\d+(?:\s*[\/of]+\s*\d+)?\s*$/i;

function normalize(s: string): string {
    return s.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
}

function isInBand(item: PdfItem, pageHeight: number): "top" | "bottom" | null {
    if (pageHeight <= 0) return null;
    const yRatio = item.y / pageHeight;
    if (yRatio >= TOP_BAND) return "top";
    if (yRatio <= BOT_BAND) return "bottom";
    return null;
}

export function stripBoilerplate(pages: PdfPage[]): PdfPage[] {
    if (pages.length < 2) {
        return pages.map(p => ({
            ...p,
            items: p.items.filter(it => !PAGE_NUMBER_RE.test(it.str.trim())),
        }));
    }
    const counts = new Map<string, number>();
    for (const p of pages) {
        const seenOnPage = new Set<string>();
        for (const item of p.items) {
            const band = isInBand(item, p.height);
            if (!band) continue;
            const key = `${band}|${normalize(item.str)}`;
            if (!key || key.endsWith("|")) continue;
            if (seenOnPage.has(key)) continue;
            seenOnPage.add(key);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }
    const threshold = Math.max(2, Math.ceil(pages.length * REPEAT_RATIO));
    const boilerplate = new Set<string>();
    for (const [key, count] of counts.entries()) {
        if (count >= threshold) boilerplate.add(key);
    }
    return pages.map(p => {
        const kept = p.items.filter(item => {
            const trimmed = item.str.trim();
            if (!trimmed) return false;
            const band = isInBand(item, p.height);
            if (band) {
                if (PAGE_NUMBER_RE.test(trimmed)) return false;
                const key = `${band}|${normalize(trimmed)}`;
                if (boilerplate.has(key)) return false;
            }
            return true;
        });
        return { ...p, items: kept };
    });
}
