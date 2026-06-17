import { authCookieOptions, authenticate, AUTH_TOKEN_KEY } from "@/utils/api/auth/credentials";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { CLIENT_HEADER, CLIENTS, parseClient } from "@memex/shared";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// Cookie-based login for browser clients (web, extension). The token is set as
// an httpOnly cookie and NEVER returned in the body — so it can't be read by
// JS/XSS. Native clients use /auth/desktop/login instead.
export const POST = withApiHandler(async (request: NextRequest) => {
    const client = parseClient(request.headers.get(CLIENT_HEADER));
    if (client === null) throw AppError.badRequest("Unsupported Client Type");
    if (client === CLIENTS.desktop) {
        throw AppError.badRequest("Desktop must use /auth/desktop/login");
    }

    const { user, token } = await authenticate(await request.json());

    (await cookies()).set({ name: AUTH_TOKEN_KEY, value: token, ...authCookieOptions });
    return user;
});
