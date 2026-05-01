import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config";
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { listDocuments, retrieve } from "./memexClient.js";

function buildServer(): McpServer {
    const server = new McpServer({
        name: "memex-remote",
        version: "0.1.0",
    });

    server.registerTool(
        "retrieve",
        {
            title: "Retrieve Tool",
            description: "Search the user's personal knowledge base. Use when the user asks about their notes, documents, or saved pages.",
            inputSchema: {
                query: z.string(),
                candidateTopN: z.number().default(20),

            }
        },
        async ({ query }: { query: string }) => {
            const hits = await retrieve(query);
            return {
                content: hits.map((h) => ({
                    type: "text",
                    text: `[${h.documentTitle}] ${h.sectionContent}`,
                })),
            };
        }
    );

    server.registerTool(
        "list_documents",
        {
            title: "List Documents",
            description: "List all documents the user has uploaded to memex.",
            inputSchema: {},
        },
        async () => {
            const docs = await listDocuments();
            return {
                content: docs.map((d) => ({
                    type: "text",
                    text: `${d.documentTitle} (${d.sourceType}) — ${d.sectionCount ?? "?"} sections`,
                })),
            };
        }
    );

    return server;
}

const app = express();
app.use(express.json({ limit: "4mb" }));

const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.header("mcp-session-id");
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
        if (!isInitializeRequest(req.body)) {
            res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Missing or invalid session" },
                id: null,
            });
            return;
        }
        const t = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
                transports.set(id, t);
            },
        });
        t.onclose = () => {
            if (t.sessionId) transports.delete(t.sessionId);
        };
        transport = t;
        const server = buildServer();
        await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.header("mcp-session-id");
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
        res.status(400).send("Missing session");
        return;
    }
    await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.header("mcp-session-id");
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
        res.status(400).send("Missing session");
        return;
    }
    await transport.handleRequest(req, res);
});

app.get("/health", (_req, res) => {
    res.json({ ok: true, name: "memex-remote", version: "0.1.0" });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
    console.log(`[memex-mcp] listening on :${port}`);
});
