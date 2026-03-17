import { prisma } from "@/utils/prisma/prisma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { CohereClient } from 'cohere-ai';
export interface RetrievalResult {
    sectionId: string;
    documentId: string;
    documentTitle: string;
    sectionContent: string;
    headingContext: string;
    similarity: number;
}

export async function vectorSearch(
    query: string,
    userId: string,
    topN: number = 20
): Promise<RetrievalResult[]> {
    const embedder = new OpenAIEmbeddings({
        model: "text-embedding-3-small",
        apiKey: process.env.OPENAI_API_KEY
    });

    const queryEmbedding = await embedder.embedQuery(query);
    const vectorStr = `[${queryEmbedding.join(",")}]`;

    const results = await prisma.$queryRaw<RetrievalResult[]>`
        SELECT 
            ds.id as "sectionId",
            ds."documentId",
            d."documentTitle",
            ds."sectionContent",
            ds."headingContext",
            1 - (ds."sectionVector" <=> ${vectorStr}::vector) as similarity
        FROM "DocumentSection" ds
        JOIN "Document" d ON ds."documentId" = d.id
        WHERE d."userId" = ${userId}
        ORDER BY ds."sectionVector" <=> ${vectorStr}::vector
        LIMIT ${topN}
    `;

    return results;
}

async function bm25Search(
    query: string,
    userId: string,
    topN: number = 20
): Promise<RetrievalResult[]> {
    const results = await prisma.$queryRaw<RetrievalResult[]>`
        SELECT 
            ds.id as "sectionId",
            ds."documentId",
            d."documentTitle",
            ds."sectionContent",
            ds."headingContext",
            ts_rank(ds."searchVector", plainto_tsquery('simple', ${query})) as similarity
        FROM "DocumentSection" ds
        JOIN "Document" d ON ds."documentId" = d.id
        WHERE d."userId" = ${userId}
            AND ds."searchVector" @@ plainto_tsquery('simple', ${query})
        ORDER BY similarity DESC
        LIMIT ${topN}
    `;

    return results;
}

function rrf(rank: number, k: number = 20) {
    return (1 / (k + rank + 1));
}

export async function hybridSearch(
    query: string,
    userId: string,
    topN: number = 20
): Promise<RetrievalResult[]> {
    const [vectorResults, bm25Results] = await Promise.all([
        vectorSearch(query, userId, topN),
        bm25Search(query, userId, topN)
    ]);

    const scores = new Map<string, { result: RetrievalResult; score: number }>();

    vectorResults.forEach((r, i) => {
        const key = r.sectionId.toString();
        scores.set(key, { result: r, score: rrf(i) });
    });

    bm25Results.forEach((r, i) => {
        const key = r.sectionId.toString();
        const existing = scores.get(key);
        if (existing) {
            existing.score += rrf(i);
        } else {
            scores.set(key, { result: r, score: rrf(i) });
        }
    });

    return Array.from(scores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map(v => v.result);
}

export async function rerank(retrievalResults: RetrievalResult[], query: string, take: number = 5): Promise<RetrievalResult[]> {
    const cohere = new CohereClient({
        token: process.env.COHERE_API_KEY
    });
    const rerankResult = await cohere.rerank({
        documents: retrievalResults.map(item => { return { "text": item.sectionContent } }),
        query,
        topN: take,
        model: "rerank-multilingual-v3.0",

    })
    return rerankResult.results.map(r => retrievalResults[r.index]).filter(r => r.similarity > 0.3);
}

export default async function retrieval(query: string, userId: string, candidateTopN: number, rerankTopN: number) {
    const candidates = await hybridSearch(query, userId, candidateTopN);
    const reranked = await rerank(candidates, query, rerankTopN);
    return reranked;
}

export async function retrievalWithoutBM25(query: string, userId: string, candidateTopN: number, rerankTopN: number) {
    const candidates = await vectorSearch(query, userId, candidateTopN);
    const reranked = await rerank(candidates, query, rerankTopN);
    return reranked;
}

export async function getDocumentList(userId: string) {
    const documents = await prisma.document.findMany({
        where: {
            userId: userId
        }
    });

    return documents;
}