export interface PdfPipelineSection {
    sectionContent: string;
    codeBlocks: string[] | null;
    chunkIndex: number;
    kind: "TEXT" | "TABLE" | "FIGURE";
    pageStart: number | null;
    pageEnd: number | null;
}

export interface PdfFidelityMetrics {
    extractedChars: number;
    afterStripChars: number;
    afterClusterChars: number;
    finalChunkChars: number;
    stripRetention: number;
    clusterRetention: number;
    chunkRetention: number;
    overallRetention: number;
}

interface DoclingPayload {
    sections: PdfPipelineSection[];
    fidelity: PdfFidelityMetrics;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function resolveDoclingUrl(): string {
    const url = process.env.DOCLING_URL?.trim();
    if (!url) {
        throw new Error("DOCLING_URL is not set. Point it at the docling service (e.g. http://docling.railway.internal:8000).");
    }
    return url.replace(/\/+$/, "");
}

export async function runPdfPipeline(fileContent: ArrayBuffer): Promise<{ sections: PdfPipelineSection[]; fidelity: PdfFidelityMetrics }> {
    const base = resolveDoclingUrl();
    const timeoutMs = Number(process.env.DOCLING_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

    const form = new FormData();
    form.append("file", new Blob([fileContent], { type: "application/pdf" }), "input.pdf");

    const headers: Record<string, string> = {};
    const secret = process.env.DOCLING_SHARED_SECRET?.trim();
    if (secret) headers["X-Docling-Secret"] = secret;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(`${base}/process`, {
            method: "POST",
            body: form,
            headers,
            signal: ctrl.signal,
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(`docling service responded ${res.status}: ${detail.slice(0, 500)}`);
        }
        const payload = (await res.json()) as DoclingPayload;
        return { sections: payload.sections, fidelity: payload.fidelity };
    } catch (err) {
        if ((err as Error).name === "AbortError") {
            throw new Error(`docling request timed out after ${timeoutMs}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}
