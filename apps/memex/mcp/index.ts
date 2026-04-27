import retrieval, { getDocumentList } from "@/utils/AI/pipeline/retrieval";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
    name: "memex",
    version: "1.0.0",
});

server.registerTool("Retrieve", {
    title: "Retrieve Tool",
    description: "Search and retrieve relevant information from the user's personal knowledge base. Use this tool when the user asks about their documents, notes, or personal knowledge.",
    inputSchema: {
        query: z.string(),
        candidateTopN: z.number().default(20),
        rerankTopN: z.number().default(5)
    }
}, async ({ query, candidateTopN, rerankTopN }) => {
    const userId = process.env.MEMEX_USER_ID as string;
    const results = await retrieval(query, userId, candidateTopN, rerankTopN);
    return {
        content: results.map(r => ({
            type: "text",
            text: `[${r.headingContext}]\n${r.sectionContent}`
        }))
    };
})

server.registerTool("document_list", {
    title: "Document list tool",
    description: "List all the document that user has uploaded",

}, async () => {
    const userId = process.env.MEMEX_USER_ID as string;
    const result = await getDocumentList(userId);
    return {
        content: result.map(r => ({
            type: "text",
            text: r.documentTitle
        }))
    }
})


const transport = new StdioServerTransport();
await server.connect(transport);