import { CUSTOM_USER_HEADER_KEY } from "@/middleware";
import retrieval from "@/utils/AI/pipeline/retrieval";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { NextRequest } from "next/server";
import { z } from "zod";
const retrievalSchema = z.object({
    query: z.string()
})

export const POST = withApiHandler(async (req: NextRequest) => {
    const payload = await req.json()
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) {
        throw AppError.internal("Critical Authentication error happened, the request does not have ")
    }
    const validationResult = retrievalSchema.safeParse(payload);
    if (!validationResult.success) {
        throw AppError.badRequest("Invalid request");
    }

    const retrievalResult = await retrieval(validationResult.data.query, userId, 20, 5);
    return retrievalResult;
});