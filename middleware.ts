import * as jose from 'jose';
import { NextRequest, NextResponse } from "next/server";
export const CUSTOM_USER_HEADER_KEY = "x-user-id"
export const AUTH_TOKEN_KEY = "auth_token";
export async function middleware(request: NextRequest) {
    const token = request.cookies.get(AUTH_TOKEN_KEY)?.value;
    if (!token) {
        if (request.nextUrl.pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        if (!process.env.JWT_SECRET) {
            throw Error("JWT Secret not configiured")
        }
        const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

        const response = NextResponse.next();
        response.headers.set(CUSTOM_USER_HEADER_KEY, payload.sub as string)
        return response;
    } catch (error) {
        console.error('JWT verification failed:', error);
        if (request.nextUrl.pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

export const config = {
    matcher: [
        '/api/v1/((?!auth/register|auth/login).*)'
    ]
}