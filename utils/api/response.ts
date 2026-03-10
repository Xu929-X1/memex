import { NextResponse } from 'next/server';
import { AppError } from './Errors';

export type SuccessBody<T> = {
    success: true;
    data: T;
    meta?: Record<string, unknown>;
};

export type ErrorBody = {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    traceId: string;
};

export function ok<T>(data: T, init?: ResponseInit & { meta?: Record<string, unknown> }) {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    const body: SuccessBody<T> = { success: true, data, meta: init?.meta };
    return new NextResponse(JSON.stringify(body), { ...init, status: init?.status ?? 200, headers });
}

export function fail(error: AppError, traceId: string, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('X-Trace-Id', traceId);
    const body: ErrorBody = {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
        traceId,
    };
    return new NextResponse(JSON.stringify(body), { ...init, status: error.status, headers });
}