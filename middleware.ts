import * as jose from 'jose';
import { NextRequest, NextResponse } from "next/server";
export const CUSTOM_USER_HEADER_KEY = "x-user-id"
export const AUTH_TOKEN_KEY = "auth_token";

const AUTH_PAGES = ['/login', '/register'];

export async function middleware(request: NextRequest) {
    const pathname = request.url;
    const token = request.cookies.get(AUTH_TOKEN_KEY)?.value;
    const isAuthPage = AUTH_PAGES.some(p => pathname.endsWith(p));
    if (!token) {
        if (request.nextUrl.pathname.startsWith('/api')) {
            console.log("Intercepted unauthorized")
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (isAuthPage) return NextResponse.next();
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        if (!process.env.JWT_SECRET) {
            throw Error("JWT Secret not configiured")
        }
        const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

        if (isAuthPage) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        const response = NextResponse.next();
        response.headers.set(CUSTOM_USER_HEADER_KEY, payload.sub as string)
        return response;
    } catch (error) {
        console.error('JWT verification failed:', error);
        if (request.nextUrl.pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (isAuthPage) return NextResponse.next();
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

export const config = {
    matcher: [
        '/api/v1/((?!auth).*)',
        '/login',
        '/register',
    ]
}