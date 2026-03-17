import { FileParseResult } from "@/app/api/v1/ingest/file/helpers";
import { HumanMessage } from "langchain";
import * as z from "zod";
import { createModel, LLM, ModelConfig } from "../model";

const ingestTextOutputSchema = z.object({
    sections: z.array(z.object({
        sectionContent: z.string().describe("Summarized section content"),
        headingContext: z.string().describe("Heading context of current section"),
        codeBlocks: z.array(z.string()).nullable().describe("If code blocks exists in the text this is where it goes"),
        chunkIndex: z.number().describe("Chunk index, start with 0")
    }))
})

export async function ingestText<T extends LLM>(
    input: string,
    LLMType: T,
    config: ModelConfig<T>
): Promise<FileParseResult> {
    const model = createModel(LLMType, config);
    const conversations = [
        new HumanMessage(input)
    ];

    const llm = await model.withStructuredOutput(ingestTextOutputSchema);
    const response = await llm.invoke(conversations);
    return response;
}