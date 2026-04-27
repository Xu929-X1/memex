import { AUTH_TOKEN_KEY } from "@/middleware";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { NextResponse } from "next/server";

export const POST = withApiHandler(async () => {
    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_TOKEN_KEY, "", {
        httpOnly: true,
        maxAge: 0,
    });
    return response;
});