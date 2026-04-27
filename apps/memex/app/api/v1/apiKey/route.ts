import { CUSTOM_USER_HEADER_KEY } from "@/middleware";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { prisma } from "@/utils/prisma/prisma";
import { NextRequest } from "next/server";
import { z } from "zod";

const CreateAPIKeySchema = z.object({
    name: z.string().min(1, { message: "name is required" })
});

export const GET = withApiHandler(async (req: NextRequest) => {
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) throw AppError.unauthorized();

    const name = req.nextUrl.searchParams.get("name");
    if (!name) throw AppError.badRequest("Query param 'name' is required");

    const apiKey = await prisma.aPIKey.findFirst({
        where: { userId, name },
        select: { id: true, name: true, createdAt: true, token: true }
    });

    if (!apiKey) throw AppError.notFound("API key not found");

    return apiKey;
});

export const POST = withApiHandler(async (req: NextRequest) => {
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) throw AppError.unauthorized();

    const body = await req.json();
    const result = CreateAPIKeySchema.safeParse(body);
    if (!result.success) throw AppError.badRequest(result.error.issues[0].message);

    const { name } = result.data;

    const existing = await prisma.aPIKey.findFirst({ where: { userId, name } });
    if (existing) throw AppError.conflict(`An API key named '${name}' already exists`);

    const token = `memex_${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")}`;

    const apiKey = await prisma.aPIKey.create({
        data: { userId, name, token },
        select: { id: true, name: true, token: true, createdAt: true }
    });

    return apiKey;
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) throw AppError.unauthorized();

    const name = req.nextUrl.searchParams.get("name");
    if (!name) throw AppError.badRequest("Query param 'name' is required");

    const apiKey = await prisma.aPIKey.findFirst({ where: { userId, name } });
    if (!apiKey) throw AppError.notFound("API key not found");

    await prisma.aPIKey.delete({ where: { id: apiKey.id } });

    return { deleted: true };
});
