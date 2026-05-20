import type { FileParseSection } from "@/app/api/v1/ingest/file/helpers";

export interface ChunkQualityReport {
    totalChunks: number;
    byKind: { TEXT: number; TABLE: number; FIGURE: number };
    sizeStats: {
        meanChars: number;
        stddevChars: number;
        p5Chars: number;
        p95Chars: number;
        tinyRate: number;
        oversizedRate: number;
    };
    midSentenceRate: number;
    whitespaceRate: number;
    boundarySimilarity: number | null;
    score: number;
    flags: string[];
}

const TINY_THRESHOLD = 100;
const OVERSIZED_THRESHOLD = 6000;
const SENTENCE_END_RE = /[.!?。？！…”"')\]\}]\s*$/;
const TARGET_MIN = 200;
const TARGET_MAX = 5000;

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
    return sorted[idx];
}

function cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function analyzeChunks(
    sections: FileParseSection[],
    embeddings: number[][] | null
): ChunkQualityReport {
    const total = sections.length;
    const byKind = { TEXT: 0, TABLE: 0, FIGURE: 0 };
    const textLengths: number[] = [];
    let midSentenceCount = 0;
    let whitespaceCharsTotal = 0;
    let charsTotal = 0;

    for (const s of sections) {
        const kind = s.kind ?? "TEXT";
        byKind[kind] = (byKind[kind] ?? 0) + 1;
        const len = s.sectionContent.length;
        charsTotal += len;
        whitespaceCharsTotal += (s.sectionContent.match(/\s/g) ?? []).length;
        if (kind === "TEXT") {
            textLengths.push(len);
            const trimmed = s.sectionContent.trim();
            if (trimmed.length > 0 && !SENTENCE_END_RE.test(trimmed)) {
                midSentenceCount++;
            }
        }
    }

    const sortedLen = [...textLengths].sort((a, b) => a - b);
    const textCount = textLengths.length;
    const mean = textCount === 0 ? 0 : sortedLen.reduce((s, v) => s + v, 0) / textCount;
    const variance = textCount === 0
        ? 0
        : sortedLen.reduce((s, v) => s + (v - mean) ** 2, 0) / textCount;
    const stddev = Math.sqrt(variance);
    const p5 = percentile(sortedLen, 5);
    const p95 = percentile(sortedLen, 95);
    const tinyRate = textCount === 0 ? 0 : textLengths.filter(l => l < TINY_THRESHOLD).length / textCount;
    const oversizedRate = textCount === 0 ? 0 : textLengths.filter(l => l > OVERSIZED_THRESHOLD).length / textCount;
    const midSentenceRate = textCount === 0 ? 0 : midSentenceCount / textCount;
    const whitespaceRate = charsTotal === 0 ? 0 : whitespaceCharsTotal / charsTotal;

    let boundarySimilarity: number | null = null;
    if (embeddings && embeddings.length === total && total >= 2) {
        let sum = 0;
        let pairs = 0;
        for (let i = 1; i < embeddings.length; i++) {
            const prev = sections[i - 1];
            const cur = sections[i];
            if (prev.kind && prev.kind !== "TEXT") continue;
            if (cur.kind && cur.kind !== "TEXT") continue;
            sum += cosine(embeddings[i - 1], embeddings[i]);
            pairs++;
        }
        boundarySimilarity = pairs > 0 ? sum / pairs : null;
    }

    const sizeInBand = textCount === 0
        ? 0
        : textLengths.filter(l => l >= TARGET_MIN && l <= TARGET_MAX).length / textCount;
    const midSentenceScore = 1 - midSentenceRate;
    const boundaryScore = boundarySimilarity === null ? 0.5 : 1 - boundarySimilarity;

    const score =
        0.30 * midSentenceScore +
        0.25 * sizeInBand +
        0.20 * boundaryScore +
        0.15 * (1 - tinyRate) +
        0.10 * (1 - oversizedRate);

    const flags: string[] = [];
    if (tinyRate > 0.2) flags.push(`tiny chunks: ${(tinyRate * 100).toFixed(1)}%`);
    if (oversizedRate > 0.1) flags.push(`oversized chunks: ${(oversizedRate * 100).toFixed(1)}%`);
    if (midSentenceRate > 0.3) flags.push(`mid-sentence cuts: ${(midSentenceRate * 100).toFixed(1)}%`);
    if (boundarySimilarity !== null && boundarySimilarity > 0.85) flags.push(`high boundary similarity: ${boundarySimilarity.toFixed(2)} (splits land mid-topic)`);
    if (whitespaceRate > 0.5) flags.push(`high whitespace ratio: ${(whitespaceRate * 100).toFixed(1)}%`);
    if (score < 0.7) flags.push(`low overall score: ${score.toFixed(2)}`);

    return {
        totalChunks: total,
        byKind,
        sizeStats: {
            meanChars: Math.round(mean),
            stddevChars: Math.round(stddev),
            p5Chars: p5,
            p95Chars: p95,
            tinyRate,
            oversizedRate,
        },
        midSentenceRate,
        whitespaceRate,
        boundarySimilarity,
        score,
        flags,
    };
}
