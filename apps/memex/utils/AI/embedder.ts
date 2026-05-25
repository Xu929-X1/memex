/**
 * Local BGE embedder for the similarity feature (desktop "looks like B").
 *
 * Singleton @xenova/transformers pipeline running bge-small-en-v1.5 (384d) on CPU.
 * Used to populate DocumentSection.simVector at ingest time and to backfill
 * historical rows. The chat-RAG path (sectionVector, 1536d OpenAI) is unchanged.
 */

import { env, pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
env.allowLocalModels = false;

// Honor HF_ENDPOINT (e.g. https://hf-mirror.com) for regions where huggingface.co
// is blocked or flaky. @xenova/transformers v2 doesn't read it automatically.
const hfEndpoint = process.env.HF_ENDPOINT?.trim();
if (hfEndpoint) {
    env.remoteHost = hfEndpoint.replace(/\/+$/, "");
}

export const SIM_EMBED_MODEL = "Xenova/bge-small-en-v1.5";
export const SIM_EMBED_DIM = 384;

let _pipe: Promise<FeatureExtractionPipeline> | null = null;

function getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!_pipe) {
        _pipe = pipeline("feature-extraction", SIM_EMBED_MODEL) as Promise<FeatureExtractionPipeline>;
    }
    return _pipe;
}

export async function embedSim(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const pipe = await getPipeline();
    const tensor = await pipe(texts, { pooling: "mean", normalize: true });
    const data = tensor.data as Float32Array;
    const dim = tensor.dims[tensor.dims.length - 1] as number;
    if (dim !== SIM_EMBED_DIM) {
        throw new Error(`embedSim: expected dim ${SIM_EMBED_DIM}, got ${dim}`);
    }
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
        out.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
    }
    return out;
}

export function toVectorLiteral(vec: number[]): string {
    return `[${vec.join(",")}]`;
}
