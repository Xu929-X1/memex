import { CUSTOM_USER_HEADER_KEY } from "@/middleware";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { prisma } from "@/utils/prisma/prisma";
import { NextRequest } from "next/server";

export const GET = withApiHandler(async (req: NextRequest) => {
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) throw AppError.unauthorized();

    const documents = await prisma.document.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { documentSections: true } } },
    });

    return documents.map(({ _count, ...doc }) => ({
        ...doc,
        sectionCount: _count.documentSections,
    }));
});
