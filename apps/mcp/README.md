# @memex/mcp — Remote MCP Server

HTTP/SSE Model Context Protocol server. Forwards `retrieve` + `list_documents` calls to a remote memex API instance (Railway).

The `apps/memex/mcp/` server (stdio, direct DB) stays for local dev. This one is meant to be deployed.

## Run locally

```bash
cp .env.example .env
# fill in MEMEX_API_KEY (create one at https://memex.up.railway.app/dashboard)
npm -w @memex/mcp run dev
```

Default port `8787`. Endpoint: `http://localhost:8787/mcp`.

## Deploy

Same Railway flow as the web app. New service → root dir `/` → build/start:

```
build: npm -w @memex/mcp run build
start: npm -w @memex/mcp run start
```

Set env vars: `MEMEX_API_URL`, `MEMEX_API_KEY`, `PORT` (Railway injects).

## Connect from Claude Desktop / Cursor

Add to MCP config:

```json
{
  "mcpServers": {
    "memex": {
      "url": "https://YOUR-MCP-URL.up.railway.app/mcp"
    }
  }
}
```

## Auth flow

- MCP server holds one memex API key (server-side env).
- API key sent as `Authorization: Bearer memex_<token>` to memex API.
- **Requires:** memex middleware extended to validate Bearer tokens (currently cookie-only). See TODO in `apps/memex/proxy.ts`.
