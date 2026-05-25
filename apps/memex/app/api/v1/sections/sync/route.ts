/**
 * GET /api/v1/sections/sync
 *
 * Cursor-paginated incremental sync for the desktop similarity replica.
 * Returns sections owned by the authenticated user with non-null simVector
 * (rows mid-backfill are intentionally hidden so the desktop never sees
 * a partial corpus).
 *
 * Query params:
 *   since  ISO-8601 timestamp. Returns rows where updatedAt > since.
 *   limit  Page size (default 500, max 2000).
 *
 * Response:
 *   { items: [{id, documentId, content, kind, pageStart, pageEnd, updatedAt, simVector:number[]}],
 *     nextCursor: ISO-8601 | null }
 */

import { CUSTOM_USER_HEADER_KEY } from "@/proxy";
import { SIM_EMBED_DIM } from "@/utils/AI/embedder";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { prisma } from "@/utils/prisma/prisma";
import { NextRequest } from "next/server";

type Row = {
    id: number;
    documentId: string;
    sectionContent: string;
    kind: string;
    pageStart: number | null;
    pageEnd: number | null;
    updatedAt: Date;
    simVectorJson: string;
};

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

function parseVectorText(s: string): number[] {
    return JSON.parse(s);
}

export const GET = withApiHandler(async (req: NextRequest) => {
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) throw AppError.unauthorized("missing user");

    const url = new URL(req.url);
    const sinceParam = url.searchParams.get("since");
    const limitParam = url.searchParams.get("limit");

    const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number(limitParam) || DEFAULT_LIMIT),
    );

    let since: Date;
    if (sinceParam) {
        const t = new Date(sinceParam);
        if (Number.isNaN(t.getTime())) throw AppError.badRequest("invalid 'since' timestamp");
        since = t;
    } else {
        since = new Date(0);
    }

    // pgvector exposes vectors as text like "[0.1,0.2,...]" which parses as JSON array.
    const rows = await prisma.$queryRaw<Row[]>`
        SELECT
            s.id,
            s."documentId",
            s."sectionContent",
            s.kind::text AS kind,
            s."pageStart",
            s."pageEnd",
            s."updatedAt",
            s."simVector"::text AS "simVectorJson"
        FROM "DocumentSection" s
        JOIN "Document" d ON d.id = s."documentId"
        WHERE d."userId" = ${userId}
          AND s."simVector" IS NOT NULL
          AND s."updatedAt" > ${since}
        ORDER BY s."updatedAt" ASC, s.id ASC
        LIMIT ${limit}
    `;

    const items = rows.map(r => {
        const vec = parseVectorText(r.simVectorJson);
        if (vec.length !== SIM_EMBED_DIM) {
            throw AppError.internal(`section ${r.id} simVector dim ${vec.length} != ${SIM_EMBED_DIM}`);
        }
        return {
            id: r.id,
            documentId: r.documentId,
            content: r.sectionContent,
            kind: r.kind,
            pageStart: r.pageStart,
            pageEnd: r.pageEnd,
            updatedAt: r.updatedAt.toISOString(),
            simVector: vec,
        };
    });

    const nextCursor = items.length === limit ? items[items.length - 1].updatedAt : null;

    return { items, nextCursor };
});
