import { SourceType } from "@/prisma/schema/client/enums";
import type { InputJsonValue } from "@/prisma/schema/client/internal/prismaNamespace";
import { CUSTOM_USER_HEADER_KEY } from "@/proxy";
import { LLM } from "@/utils/AI/model";
import { analyzeChunks } from "@/utils/AI/QC/analyzer";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { prisma } from "@/utils/prisma/prisma";
import { ChatAnthropicInput } from "@langchain/anthropic";
import { ChatOpenAIFields, OpenAIEmbeddings } from "@langchain/openai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { FileParseResult, parseMarkdown, parsePDF, parseText } from "./helpers";

export const runtime = "nodejs";

export const SUPPORTED_FILE_TYPES = {
    PDF: "PDF",
    MARKDOWN: "MARKDOWN",
    TEXT: "TEXT",
}

const fileSchema = z.object({
    file: z.instanceof(File, { message: "file must be an instance of File" }),
    documentTitle: z.string().optional(),
    model: z.enum(["gpt-4o-mini", "gpt-4o", "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"])
})

function stripExtension(filename: string): string {
    const dot = filename.lastIndexOf(".");
    return dot > 0 ? filename.slice(0, dot) : filename;
}

function mapSuffixToFileType(suffix: string): string | null {
    switch (suffix) {
        case "pdf":
            return SUPPORTED_FILE_TYPES.PDF;
        case "md":
            return SUPPORTED_FILE_TYPES.MARKDOWN;
        case "txt":
            return SUPPORTED_FILE_TYPES.TEXT;
        default:
            return null;
    }
}


export const POST = withApiHandler(async (req: NextRequest, _, traceId) => {
    const formData = await req.formData();
    const requestFile = formData.get("file") as File;
    const requestTitle = formData.get("documentTitle") as string;
    const model = formData.get("model") as string;
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) {
        throw AppError.internal("Critical Authentication error happened, the request does not have ")
    }
    const validationResult = fileSchema.safeParse({ file: requestFile, documentTitle: requestTitle || undefined, model: model });
    if (!validationResult.success) {
        throw AppError.badRequest("Invalid request, required fields are: file and model");
    }
    let llmType: LLM;
    let llmConfig: Partial<ChatOpenAIFields> | Partial<ChatAnthropicInput>;
    if ((model as string).startsWith("gpt")) {
        llmType = "openai"
        llmConfig = {
            model: model,
            temperature: 0
        }
    } else {
        llmType = "anthropic"
        llmConfig = {
            model: model,
            temperature: 0
        }
    }


    const { file, documentTitle } = validationResult.data;
    const resolvedTitle = documentTitle?.trim() || stripExtension(file.name);
    const documentType = mapSuffixToFileType(file.name.split(".").pop() ?? "")?.toLowerCase();
    if (!documentType) {
        throw AppError.badRequest("File has no extension");
    }
    let parseResult: FileParseResult
    try {
        switch (documentType) {
            case SUPPORTED_FILE_TYPES.PDF.toLowerCase():
                parseResult = await parsePDF(file, traceId);
                break;
            case SUPPORTED_FILE_TYPES.MARKDOWN.toLowerCase():
                parseResult = await parseMarkdown(file);
                break;
            case SUPPORTED_FILE_TYPES.TEXT.toLowerCase():
                const text = await file.text()
                parseResult = await parseText(text)
                break;
            default:
                throw AppError.badRequest("Unsupported file type");
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw AppError.badRequest(`parse failed: ${(err as Error).message}`);
    }
    const embedder = new OpenAIEmbeddings({
        model: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY
    })
    const embeddings = await embedder.embedDocuments(
        parseResult.sections.map(s => s.sectionContent)
    )
    return await prisma.$transaction(async (tx) => {
        //save document
        const document = await tx.document.create({
            data: {
                documentTitle: resolvedTitle,
                source: "uploaded",
                sourceType: documentType.toUpperCase() as SourceType,
                userId: userId
            }
        })

        for (let i = 0; i < parseResult.sections.length; i++) {
            const item = parseResult.sections[i];
            const vectorStr = `[${embeddings[i].join(",")}]`;
            const kind = item.kind ?? "TEXT";
            const pageStart = item.pageStart ?? null;
            const pageEnd = item.pageEnd ?? null;

            await tx.$executeRaw`INSERT INTO "DocumentSection" ("documentId", "sectionContent", "chunkIndex", "sectionVector", "kind", "pageStart", "pageEnd")
    VALUES (${document.id}, ${item.sectionContent}, ${item.chunkIndex}, ${vectorStr}::vector, ${kind}::"SectionKind", ${pageStart}, ${pageEnd})`
        }

        const qcReport = analyzeChunks(parseResult.sections, embeddings);
        const pdfFidelity = parseResult.pdfFidelity ?? null;
        const metricsPayload = { ...qcReport, pdfFidelity };
        const qcRun = await tx.chunkQualityRun.create({
            data: {
                documentId: document.id,
                sourceType: documentType.toUpperCase() as SourceType,
                totalChunks: qcReport.totalChunks,
                textCount: qcReport.byKind.TEXT,
                tableCount: qcReport.byKind.TABLE,
                figureCount: qcReport.byKind.FIGURE,
                meanChars: qcReport.sizeStats.meanChars,
                stddevChars: qcReport.sizeStats.stddevChars,
                p5Chars: qcReport.sizeStats.p5Chars,
                p95Chars: qcReport.sizeStats.p95Chars,
                tinyRate: qcReport.sizeStats.tinyRate,
                oversizedRate: qcReport.sizeStats.oversizedRate,
                midSentenceRate: qcReport.midSentenceRate,
                whitespaceRate: qcReport.whitespaceRate,
                boundarySimilarity: qcReport.boundarySimilarity,
                score: qcReport.score,
                flags: qcReport.flags as unknown as InputJsonValue,
                metrics: metricsPayload as unknown as InputJsonValue,
            },
        });
        return { documentId: document.id, qcRunId: qcRun.id, qcReport, pdfFidelity }
    }, {
        timeout: 30000,
    })
});
