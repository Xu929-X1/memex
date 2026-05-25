/**
 * One-time backfill: populate DocumentSection.simVector for rows where it is NULL.
 *
 * Idempotent + resumable: re-running picks up where it left off because the WHERE
 * clause filters on NULL. Safe to ctrl-c mid-run.
 *
 * Usage:
 *   cd apps/memex
 *   npx tsx scripts/backfill-simvector.ts                # live
 *   npx tsx scripts/backfill-simvector.ts --dry-run      # count only
 *   BATCH=200 npx tsx scripts/backfill-simvector.ts      # tune batch size
 */

// Must load env before importing prisma — prisma.ts reads DATABASE_URL at import time
// and the global `dotenv/config` only picks up `.env`, not `.env.local`.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { embedSim, toVectorLiteral } from "@/utils/AI/embedder";
import { prisma } from "@/utils/prisma/prisma";

const BATCH = Number(process.env.BATCH) || 100;
const DRY = process.argv.includes("--dry-run");

type Row = { id: number; sectionContent: string };

async function pendingCount(): Promise<number> {
    // simVector is Unsupported("vector") — not exposed on the typed client.
    // Must use raw SQL for any read/filter against it.
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "DocumentSection" WHERE "simVector" IS NULL
    `;
    return Number(rows[0]?.count ?? 0);
}

async function fetchBatch(): Promise<Row[]> {
    return prisma.$queryRaw<Row[]>`
        SELECT id, "sectionContent"
        FROM "DocumentSection"
        WHERE "simVector" IS NULL
        ORDER BY id
        LIMIT ${BATCH}
    `;
}

async function main() {
    const initial = await pendingCount();
    console.log(`backfill: ${initial} sections pending. batch=${BATCH} dry=${DRY}`);
    if (DRY || initial === 0) {
        await prisma.$disconnect();
        return;
    }

    let processed = 0;
    const t0 = Date.now();
    for (; ;) {
        const rows = await fetchBatch();
        if (rows.length === 0) break;

        const vecs = await embedSim(rows.map(r => r.sectionContent));
        for (let i = 0; i < rows.length; i++) {
            const id = rows[i].id;
            const literal = toVectorLiteral(vecs[i]);
            await prisma.$executeRaw`
                UPDATE "DocumentSection"
                SET "simVector" = ${literal}::vector
                WHERE id = ${id}
            `;
        }

        processed += rows.length;
        const rate = processed / Math.max(1, (Date.now() - t0) / 1000);
        const remaining = await pendingCount();
        console.log(
            `backfill: +${rows.length} (total ${processed}) rate=${rate.toFixed(1)}/s remaining=${remaining}`,
        );
    }

    console.log(`backfill: done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error("backfill failed:", err);
    await prisma.$disconnect();
    process.exit(1);
});
