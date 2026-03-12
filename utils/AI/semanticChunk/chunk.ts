import { OpenAIEmbeddings } from "@langchain/openai";
import nlp from "compromise";
import { encoding_for_model } from "tiktoken";

function splitSentences(text: string): string[] {
    const doc = nlp(text);
    return doc.sentences().out("array");
}

async function embedSentences(sentences: string[]): Promise<number[][]> {
    const embedder = new OpenAIEmbeddings({
        model: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY
    })
    return await embedder.embedDocuments(sentences);
}

function semanticChunk(sentences: string[], embeddings: number[][], maxToken: number = 2000): string[][] {
    const enc = encoding_for_model("gpt-4o-mini");

    try {
        let currentToken = 0, currentChunk: string[] = [];
        //for now I use gpt-4o-mini as the model to calc token count
        const chunkResult: string[][] = [];
        const similarities: number[] = [];
        for (let i = 0; i < sentences.length; i++) {
            const tokenCount = enc.encode(sentences[i]).length;
            //for super long sentences
            if (tokenCount > maxToken) {
                const subChunks = splitLongSentence(sentences[i], maxToken, enc)
                for (const sub of subChunks) {
                    chunkResult.push([sub]);
                }
                continue;
            }

            if (currentToken + tokenCount >= maxToken) {
                chunkResult.push(currentChunk);
                currentToken = tokenCount;
                currentChunk = [sentences[i]];
                continue;
            }

            if (i > 0) {
                const relavance = cosineSimilarity(embeddings[i - 1], embeddings[i]);
                similarities[i] = relavance;
                const threshold = similarities.filter(Boolean).length >= 5
                    ? calculateThreshold(similarities)
                    : 0.75
                if (relavance < threshold) {
                    chunkResult.push(currentChunk);
                    currentChunk = [];
                    currentChunk.push(sentences[i]);
                    currentToken = tokenCount;
                    continue;
                }
            }

            currentToken += tokenCount;
            currentChunk.push(sentences[i]);
        }
        if (currentChunk.length > 0) {
            chunkResult.push(currentChunk);
        }
        return chunkResult
    } finally {
        enc.free();
    }
}

function cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return (dot / (magA * magB))
}

function calculateThreshold(similarities: number[], percentile: number = 25): number {
    const sorted = [...similarities].sort((a, b) => a - b)
    const index = Math.floor(sorted.length * percentile / 100)
    return sorted[index]
}


function splitLongSentence(sentence: string, maxToken: number, enc: any): string[] {
    const tokens = enc.encode(sentence)
    const chunks: string[] = []

    for (let i = 0; i < tokens.length; i += maxToken) {
        const chunkTokens = tokens.slice(i, i + maxToken)
        chunks.push(new TextDecoder().decode(enc.decode(chunkTokens)))
    }

    return chunks
}

export async function chunk(rawDoc: string, maxToken: number = 2000) {
    const sentences = splitSentences(rawDoc);
    const embeddings = await embedSentences(sentences);
    const chunkResult = semanticChunk(sentences, embeddings, 2000);

    return chunkResult
}