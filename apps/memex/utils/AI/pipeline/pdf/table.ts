import type { PdfBlock, PdfItem, PdfPage } from "./types";

const Y_TOLERANCE = 2;
const COL_X_TOLERANCE = 8;
const MIN_TABLE_ROWS = 3;
const MIN_TABLE_COLS = 2;
const COLUMN_GAP_FACTOR = 2.0;

interface Row {
    y: number;
    items: PdfItem[];
}

interface Cell {
    text: string;
    xStart: number;
    xEnd: number;
}

function groupRows(items: PdfItem[]): Row[] {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => b.y - a.y);
    const rows: Row[] = [];
    for (const item of sorted) {
        const last = rows[rows.length - 1];
        if (last && Math.abs(last.y - item.y) <= Y_TOLERANCE) {
            last.items.push(item);
            last.y = (last.y * (last.items.length - 1) + item.y) / last.items.length;
        } else {
            rows.push({ y: item.y, items: [item] });
        }
    }
    for (const r of rows) r.items.sort((a, b) => a.x - b.x);
    return rows;
}

function rowToCells(row: Row): Cell[] {
    if (row.items.length === 0) return [];
    const gaps: number[] = [];
    for (let i = 1; i < row.items.length; i++) {
        const prev = row.items[i - 1];
        const cur = row.items[i];
        const gap = cur.x - (prev.x + prev.w);
        if (gap > 0) gaps.push(gap);
    }
    const medianGap = median(gaps);
    const threshold = Math.max(8, medianGap * COLUMN_GAP_FACTOR);
    const cells: Cell[] = [];
    let buf: PdfItem[] = [row.items[0]];
    for (let i = 1; i < row.items.length; i++) {
        const prev = row.items[i - 1];
        const cur = row.items[i];
        const gap = cur.x - (prev.x + prev.w);
        if (gap > threshold) {
            cells.push(mergeCell(buf));
            buf = [cur];
        } else {
            buf.push(cur);
        }
    }
    if (buf.length > 0) cells.push(mergeCell(buf));
    return cells;
}

function mergeCell(items: PdfItem[]): Cell {
    const text = items.map(i => i.str).join(" ").replace(/\s+/g, " ").trim();
    const xStart = items[0].x;
    const last = items[items.length - 1];
    return { text, xStart, xEnd: last.x + last.w };
}

function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function columnsAlign(a: Cell[], b: Cell[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i].xStart - b[i].xStart) > COL_X_TOLERANCE) return false;
    }
    return true;
}

function serializeMarkdown(rows: Cell[][]): string {
    if (rows.length === 0) return "";
    const cols = rows[0].length;
    const lines: string[] = [];
    const header = rows[0].map(c => escapeCell(c.text)).join(" | ");
    lines.push(`| ${header} |`);
    lines.push(`| ${Array(cols).fill("---").join(" | ")} |`);
    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].map(c => escapeCell(c.text));
        while (cells.length < cols) cells.push("");
        lines.push(`| ${cells.slice(0, cols).join(" | ")} |`);
    }
    return lines.join("\n");
}

function escapeCell(s: string): string {
    return s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

export interface TableDetectionResult {
    tables: Array<PdfBlock & { kind: "TABLE"; rowYRange: [number, number] }>;
    leftoverItemsByPage: Map<number, PdfItem[]>;
}

export function detectTables(pages: PdfPage[]): TableDetectionResult {
    const tables: TableDetectionResult["tables"] = [];
    const leftoverItemsByPage = new Map<number, PdfItem[]>();
    for (const p of pages) {
        const rows = groupRows(p.items);
        const cellRows = rows.map(r => ({ row: r, cells: rowToCells(r) }));
        const consumed = new Set<number>();
        let i = 0;
        while (i < cellRows.length) {
            const start = cellRows[i];
            if (start.cells.length >= MIN_TABLE_COLS) {
                let j = i + 1;
                while (j < cellRows.length && columnsAlign(start.cells, cellRows[j].cells)) {
                    j++;
                }
                const span = j - i;
                if (span >= MIN_TABLE_ROWS) {
                    const tableRows = cellRows.slice(i, j).map(cr => cr.cells);
                    const markdown = serializeMarkdown(tableRows);
                    const yTop = cellRows[i].row.y;
                    const yBot = cellRows[j - 1].row.y;
                    tables.push({
                        kind: "TABLE",
                        page: p.page,
                        rows: tableRows.map(r => r.map(c => c.text)),
                        markdown,
                        rowYRange: [yBot, yTop],
                    });
                    for (let k = i; k < j; k++) consumed.add(k);
                    i = j;
                    continue;
                }
            }
            i++;
        }
        const leftoverItems: PdfItem[] = [];
        for (let k = 0; k < cellRows.length; k++) {
            if (consumed.has(k)) continue;
            leftoverItems.push(...cellRows[k].row.items);
        }
        leftoverItemsByPage.set(p.page, leftoverItems);
    }
    return { tables, leftoverItemsByPage };
}
