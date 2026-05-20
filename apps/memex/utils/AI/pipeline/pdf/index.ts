import { extractPages } from "./extract";
import { detectFigures } from "./figure";
import { stripBoilerplate } from "./footer";
import { detectTables } from "./table";
import type { PdfItem, PdfPage } from "./types";

const TEXT_BLOCK_TARGET = 1500;
const TEXT_BLOCK_HARD_MAX = 4500;
const TEXT_BLOCK_MIN_CHARS = 400;
const LINE_Y_TOLERANCE = 2;
const PARAGRAPH_GAP_FACTOR = 1.6;
const SENTENCE_END = /[.!?。？！…”"')\]\}]\s*$/;
const HYPHEN_END = /[a-zA-ZÀ-ɏ]-$/;
const CJK_CHAR = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;

interface Line {
    page: number;
    y: number;
    text: string;
    height: number;
}

interface Paragraph {
    text: string;
    pageStart: number;
    pageEnd: number;
    yTop: number;
    endsSentence: boolean;
}

type Element =
    | { kind: "LINE"; page: number; yTop: number; line: Line }
    | { kind: "TABLE"; page: number; yTop: number; markdown: string; rows: string[][] }
    | { kind: "FIGURE"; page: number; yTop: number; caption: string | null; bboxY: number; bboxH: number };

function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function clusterLines(items: PdfItem[], page: number): Line[] {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => b.y - a.y);
    const grouped: Array<{ y: number; items: PdfItem[] }> = [];
    for (const it of sorted) {
        const last = grouped[grouped.length - 1];
        if (last && Math.abs(last.y - it.y) <= LINE_Y_TOLERANCE) {
            last.items.push(it);
        } else {
            grouped.push({ y: it.y, items: [it] });
        }
    }
    const lines: Line[] = [];
    for (const g of grouped) {
        g.items.sort((a, b) => a.x - b.x);
        const parts: string[] = [];
        for (let i = 0; i < g.items.length; i++) {
            const s = g.items[i].str;
            if (!s) continue;
            if (parts.length === 0) {
                parts.push(s);
                continue;
            }
            const prev = parts[parts.length - 1];
            const lastCh = prev[prev.length - 1] ?? "";
            const firstCh = s[0] ?? "";
            if (CJK_CHAR.test(lastCh) && CJK_CHAR.test(firstCh)) {
                parts[parts.length - 1] = prev + s;
            } else {
                parts.push(s);
            }
        }
        const text = parts.join(" ").replace(/[ \t]+/g, " ").trim();
        if (!text) continue;
        const height = median(g.items.map(i => i.h).filter(h => h > 0)) || 10;
        lines.push({ page, y: g.y, text, height });
    }
    return lines;
}

function joinParagraphLines(texts: string[]): string {
    if (texts.length === 0) return "";
    let out = texts[0];
    for (let i = 1; i < texts.length; i++) {
        const next = texts[i];
        if (!next) continue;
        if (HYPHEN_END.test(out)) {
            out = out.slice(0, -1) + next;
            continue;
        }
        const lastCh = out[out.length - 1] ?? "";
        const firstCh = next[0] ?? "";
        if (CJK_CHAR.test(lastCh) && CJK_CHAR.test(firstCh)) {
            out = out + next;
        } else {
            out = `${out} ${next}`;
        }
    }
    return out.replace(/[ \t]+/g, " ").trim();
}

interface PipelineState {
    paraBuf: Line[];
    chunkBuf: Paragraph[];
    chunkLen: number;
    chunkPageMin: number;
    chunkPageMax: number;
    chunkYTop: number;
    chunkPage: number;
    output: Array<{ kind: "TEXT" | "TABLE" | "FIGURE"; content: string; page: number; pageStart: number; pageEnd: number; yTop: number }>;
    globalGapThreshold: number;
}

function flushParagraph(state: PipelineState) {
    if (state.paraBuf.length === 0) return;
    const text = joinParagraphLines(state.paraBuf.map(l => l.text));
    if (!text) {
        state.paraBuf = [];
        return;
    }
    const pages = state.paraBuf.map(l => l.page);
    const paragraph: Paragraph = {
        text,
        pageStart: Math.min(...pages),
        pageEnd: Math.max(...pages),
        yTop: state.paraBuf[0].y,
        endsSentence: SENTENCE_END.test(text),
    };
    if (state.chunkBuf.length === 0) {
        state.chunkPage = paragraph.pageStart;
        state.chunkYTop = paragraph.yTop;
        state.chunkPageMin = paragraph.pageStart;
        state.chunkPageMax = paragraph.pageEnd;
    } else {
        state.chunkPageMin = Math.min(state.chunkPageMin, paragraph.pageStart);
        state.chunkPageMax = Math.max(state.chunkPageMax, paragraph.pageEnd);
    }
    state.chunkBuf.push(paragraph);
    state.chunkLen += paragraph.text.length + 2;
    state.paraBuf = [];

    if (state.chunkLen >= TEXT_BLOCK_HARD_MAX) {
        flushChunk(state);
    } else if (paragraph.endsSentence && state.chunkLen >= TEXT_BLOCK_TARGET) {
        flushChunk(state);
    }
}

function flushChunk(state: PipelineState) {
    if (state.chunkBuf.length === 0) return;
    const text = state.chunkBuf.map(p => p.text).join("\n\n");
    state.output.push({
        kind: "TEXT",
        content: text,
        page: state.chunkPage,
        pageStart: state.chunkPageMin,
        pageEnd: state.chunkPageMax,
        yTop: state.chunkYTop,
    });
    state.chunkBuf = [];
    state.chunkLen = 0;
}

function handleLine(state: PipelineState, line: Line) {
    if (state.paraBuf.length === 0) {
        state.paraBuf.push(line);
        return;
    }
    const prev = state.paraBuf[state.paraBuf.length - 1];
    let breakHere = false;
    if (prev.page === line.page) {
        const gap = prev.y - line.y;
        if (gap > state.globalGapThreshold) breakHere = true;
        if (SENTENCE_END.test(prev.text)) breakHere = true;
    } else {
        if (SENTENCE_END.test(prev.text)) breakHere = true;
    }
    if (breakHere) {
        flushParagraph(state);
    }
    state.paraBuf.push(line);
}

export interface PdfPipelineSection {
    sectionContent: string;
    codeBlocks: string[] | null;
    chunkIndex: number;
    kind: "TEXT" | "TABLE" | "FIGURE";
    pageStart: number;
    pageEnd: number;
}

export async function runPdfPipeline(fileContent: ArrayBuffer): Promise<{ sections: PdfPipelineSection[] }> {
    const rawPages = await extractPages(fileContent);
    const pages = stripBoilerplate(rawPages);

    const { figures, consumedCaptionItems } = detectFigures(pages);

    const pagesAfterFigure: PdfPage[] = pages.map(p => ({
        ...p,
        items: p.items.filter(it => !consumedCaptionItems.has(it)),
    }));

    const { tables, leftoverItemsByPage } = detectTables(pagesAfterFigure);

    const allLines: Line[] = [];
    for (const p of pagesAfterFigure) {
        const leftover = leftoverItemsByPage.get(p.page) ?? [];
        allLines.push(...clusterLines(leftover, p.page));
    }

    const medianH = median(allLines.map(l => l.height).filter(h => h > 0)) || 10;
    const globalGapThreshold = medianH * PARAGRAPH_GAP_FACTOR;

    const elements: Element[] = [];
    for (const l of allLines) {
        elements.push({ kind: "LINE", page: l.page, yTop: l.y, line: l });
    }
    for (const t of tables) {
        elements.push({ kind: "TABLE", page: t.page, yTop: t.rowYRange[1], markdown: t.markdown, rows: t.rows });
    }
    for (const f of figures) {
        elements.push({ kind: "FIGURE", page: f.page, yTop: f.bbox.y + f.bbox.h, caption: f.caption, bboxY: f.bbox.y, bboxH: f.bbox.h });
    }
    elements.sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        return b.yTop - a.yTop;
    });

    const state: PipelineState = {
        paraBuf: [],
        chunkBuf: [],
        chunkLen: 0,
        chunkPageMin: 0,
        chunkPageMax: 0,
        chunkYTop: 0,
        chunkPage: 0,
        output: [],
        globalGapThreshold,
    };

    for (const el of elements) {
        if (el.kind === "LINE") {
            handleLine(state, el.line);
            continue;
        }
        flushParagraph(state);
        flushChunk(state);
        if (el.kind === "TABLE") {
            state.output.push({
                kind: "TABLE",
                content: el.markdown,
                page: el.page,
                pageStart: el.page,
                pageEnd: el.page,
                yTop: el.yTop,
            });
        } else {
            const caption = el.caption ? el.caption : "(no caption)";
            state.output.push({
                kind: "FIGURE",
                content: `[FIGURE p${el.page}] ${caption}`,
                page: el.page,
                pageStart: el.page,
                pageEnd: el.page,
                yTop: el.yTop,
            });
        }
    }
    flushParagraph(state);
    flushChunk(state);

    const sections: PdfPipelineSection[] = state.output
        .filter(o => o.content && o.content.length >= 2)
        .map((o, i) => ({
            sectionContent: o.content,
            codeBlocks: null,
            chunkIndex: i,
            kind: o.kind,
            pageStart: o.pageStart,
            pageEnd: o.pageEnd,
        }));

    return { sections };
}
