import { authenticate } from "@/utils/api/auth/credentials";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { CLIENT_HEADER, CLIENTS, parseClient } from "@memex/shared";
import { NextRequest } from "next/server";

// Token-in-body login for the desktop app. The desktop webview can't use the
// httpOnly cookie (native HTTP bypasses the cookie jar), so it stores the token
// in the OS keychain and sends it back as the `auth_token` header.
//
// This lives on a separate path — not a header branch on /auth/login — so a
// browser/XSS context can never coax the raw JWT into a readable response body.
export const POST = withApiHandler(async (request: NextRequest) => {
    const client = parseClient(request.headers.get(CLIENT_HEADER));
    if (client !== CLIENTS.desktop) throw AppError.forbidden("Desktop client only");

    const { user, token } = await authenticate(await request.json());
    return { ...user, token };
});
