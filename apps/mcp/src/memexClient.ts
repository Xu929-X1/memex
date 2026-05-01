const API_URL = process.env.MEMEX_API_URL ?? "https://memex.up.railway.app";
const API_KEY = process.env.MEMEX_API_KEY ?? "";

if (!API_KEY) {
    console.error("[memex-mcp] MEMEX_API_KEY missing");
}

type Envelope<T> =
    | { success: true; data: T; meta?: Record<string, unknown> }
    | { success: false; error: { code: string; message: string; details?: unknown }; traceId: string };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
            ...(init.headers ?? {}),
        },
    });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body) {
        const msg = body && !body.success ? body.error.message : `HTTP ${res.status}`;
        throw new Error(`memex API: ${msg}`);
    }
    if (!body.success) {
        throw new Error(`memex API: ${body.error.message}`);
    }
    return body.data;
}

export interface RetrievalHit {
    sectionId: string | number;
    documentId: string;
    documentTitle: string;
    sectionContent: string;
    similarity: number;
}

export interface DocumentSummary {
    id: string;
    documentTitle: string;
    sourceType: string;
    createdAt: string;
    sectionCount?: number;
}

export async function retrieve(query: string): Promise<RetrievalHit[]> {
    return request<RetrievalHit[]>("/api/v1/retrieval", {
        method: "POST",
        body: JSON.stringify({ query }),
    });
}

export async function listDocuments(): Promise<DocumentSummary[]> {
    return request<DocumentSummary[]>("/api/v1/documents", { method: "GET" });
}
