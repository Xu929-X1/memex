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

function logPrefix(traceId?: string): string {
    return traceId ? `[pdf-pipeline ${traceId}]` : "[pdf-pipeline]";
}

export async function runPdfPipeline(
    fileContent: ArrayBuffer,
    traceId?: string,
): Promise<{ sections: PdfPipelineSection[]; fidelity: PdfFidelityMetrics }> {
    const base = resolveDoclingUrl();
    const timeoutMs = Number(process.env.DOCLING_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    const prefix = logPrefix(traceId);

    const form = new FormData();
    form.append("file", new Blob([fileContent], { type: "application/pdf" }), "input.pdf");

    const headers: Record<string, string> = {};
    const secret = process.env.DOCLING_SHARED_SECRET?.trim();
    if (secret) headers["X-Docling-Secret"] = secret;
    if (traceId) headers["X-Trace-Id"] = traceId;

    const target = `${base}/process`;
    const sizeBytes = fileContent.byteLength;
    const t0 = Date.now();
    console.info(
        `${prefix} request → ${target} size=${sizeBytes}B timeout=${timeoutMs}ms auth=${secret ? "yes" : "no"}`,
    );

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(target, {
            method: "POST",
            body: form,
            headers,
            signal: ctrl.signal,
        });
        const elapsedMs = Date.now() - t0;
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            console.error(
                `${prefix} response status=${res.status} elapsed=${elapsedMs}ms body=${detail.slice(0, 500)}`,
            );
            throw new Error(`docling service responded ${res.status}: ${detail.slice(0, 500)}`);
        }
        const payload = (await res.json()) as DoclingPayload;
        console.info(
            `${prefix} response ok status=${res.status} elapsed=${elapsedMs}ms sections=${payload.sections?.length ?? 0} extractedChars=${payload.fidelity?.extractedChars ?? 0} overallRetention=${payload.fidelity?.overallRetention?.toFixed?.(3) ?? "n/a"}`,
        );
        return { sections: payload.sections, fidelity: payload.fidelity };
    } catch (err) {
        const elapsedMs = Date.now() - t0;
        if ((err as Error).name === "AbortError") {
            console.error(`${prefix} aborted (timeout) elapsed=${elapsedMs}ms timeout=${timeoutMs}ms target=${target}`);
            throw new Error(`docling request timed out after ${timeoutMs}ms`);
        }
        console.error(`${prefix} error elapsed=${elapsedMs}ms target=${target} err=${(err as Error).message}`);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}
