import { createAccount } from "@/utils/api/auth/credentials";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { CLIENT_HEADER, CLIENTS, parseClient } from "@memex/shared";
import { NextRequest } from "next/server";

// Token-in-body registration for the desktop app. See ../login/route.ts for why
// this is a dedicated path rather than a header branch on /auth/register.
export const POST = withApiHandler(async (request: NextRequest) => {
    const client = parseClient(request.headers.get(CLIENT_HEADER));
    if (client !== CLIENTS.desktop) throw AppError.forbidden("Desktop client only");
    if (request.headers.get("origin")) throw AppError.forbidden("Desktop client only");

    const { user, token } = await createAccount(await request.json());
    return { ...user, token };
});
