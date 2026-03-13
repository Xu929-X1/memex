import { CUSTOM_USER_HEADER_KEY } from "@/middleware";
import { SourceType } from "@/prisma/schema/client/enums";
import { LLM } from "@/utils/AI/model";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { prisma } from "@/utils/prisma/prisma";
import { ChatAnthropicInput } from "@langchain/anthropic";
import { ChatOpenAIFields, OpenAIEmbeddings } from "@langchain/openai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { FileParseResult, parseMarkdown, parsePDF, parseText } from "./helpers";

export const SUPPORTED_FILE_TYPES = {
    PDF: "PDF",
    MARKDOWN: "MARKDOWN",
    TEXT: "TXT",
}

const fileSchema = z.object({
    file: z.instanceof(File, { message: "file must be an instance of File" }),
    documentTitle: z.string().min(1, { message: "documentTitle is required" }),
    model: z.enum(["gpt-4o-mini", "gpt-4o", "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"])
})

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
    const validationResult = fileSchema.safeParse({ file: requestFile, documentTitle: requestTitle, model: model });
    if (!validationResult.success) {
        throw AppError.badRequest("Invalid request, required fields are: file, documentTitle and model");
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
    const documentType = mapSuffixToFileType(file.name.split(".").pop() ?? "")?.toLowerCase();
    if (!documentType) {
        throw AppError.badRequest("File has no extension");
    }
    let parseResult: FileParseResult
    switch (documentType) {
        case SUPPORTED_FILE_TYPES.PDF.toLowerCase():
            parseResult = await parsePDF(file, llmType, llmConfig);
            break;
        case SUPPORTED_FILE_TYPES.MARKDOWN.toLowerCase():
            parseResult = await parseMarkdown(file);
            break;
        case SUPPORTED_FILE_TYPES.TEXT.toLowerCase():
            const text = await file.text()
            parseResult = await parseText(text, llmType, llmConfig)
            break;
        default:
            throw AppError.badRequest("Unsupported file type");
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
                documentTitle: documentTitle,
                source: "uploaded",
                sourceType: documentType.toUpperCase() as SourceType,
                userId: userId
            }
        })

        for (let i = 0; i < parseResult.sections.length; i++) {
            const item = parseResult.sections[i];
            const vectorStr = `[${embeddings[i].join(",")}]`;

            await tx.$executeRaw` INSERT INTO "DocumentSection" ("documentId", "sectionContent", "headingContext", "chunkIndex", "sectionVector")
    VALUES ( ${document.id}, ${item.sectionContent}, ${item.headingContext}, ${item.chunkIndex}, ${vectorStr}::vector)`
        }

        return { documentId: document.id }
    })
});
