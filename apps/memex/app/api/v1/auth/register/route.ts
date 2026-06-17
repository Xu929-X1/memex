import { authCookieOptions, createAccount, AUTH_TOKEN_KEY } from "@/utils/api/auth/credentials";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { CLIENT_HEADER, CLIENTS, parseClient } from "@memex/shared";
import { NextRequest, NextResponse } from "next/server";

// Cookie-based registration for browser clients (web, extension). Token is set
// as an httpOnly cookie, never returned in the body. Native clients use
// /auth/desktop/register.
export const POST = withApiHandler(async (request: NextRequest) => {
    const client = parseClient(request.headers.get(CLIENT_HEADER));
    if (client === null) throw AppError.badRequest("Unsupported Client Type");
    if (client === CLIENTS.desktop) {
        throw AppError.badRequest("Desktop must use /auth/desktop/register");
    }

    const { user, token } = await createAccount(await request.json());

    const response = NextResponse.json(user, { status: 201 });
    response.cookies.set(AUTH_TOKEN_KEY, token, authCookieOptions);
    return response;
});
