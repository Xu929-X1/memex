import { NextResponse, type NextRequest } from 'next/server';
import { AppError } from './Errors';
import { fail, ok } from './response';

type DynCtx = { params: Promise<Record<string, string>> } | { params: Record<string, string> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPromise<T>(v: any): v is Promise<T> {
  return v && typeof v.then === 'function';
}
async function resolveParams(ctx?: DynCtx): Promise<Record<string, string>> {
  if (!ctx) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (ctx as any).params;
  if (!p) return {};
  return isPromise<Record<string, string>>(p) ? await p : p;
}

function genTraceId(req?: NextRequest) {
  const h = req?.headers;
  const tp = h?.get('traceparent');
  if (tp) {
    const parts = tp.split('-');
    if (parts[1]) return parts[1];
  }
  return h?.get('x-trace-id') ?? h?.get('x-request-id') ?? (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
}

export function withApiHandler<T>(
  handler: (
    req: NextRequest,
    context: { params: Record<string, string> },
    traceId: string
  ) => Promise<T> | T,
  options?: { cors?: { origin?: string; methods?: string[]; headers?: string[] } }
) {
  const impl = async (req: NextRequest, ctx?: DynCtx) => {
    const traceId = genTraceId(req);

    try {
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': options?.cors?.origin ?? '*',
            'Access-Control-Allow-Methods': (options?.cors?.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).join(','),
            'Access-Control-Allow-Headers': (options?.cors?.headers ?? ['Content-Type', 'Authorization']).join(','),
          },
        });
      }

      const params = await resolveParams(ctx);
      const data = await handler(req, { params }, traceId);

      if (data instanceof NextResponse) {
        data.headers.set('X-Trace-Id', traceId)
        return data
      }

      const res = ok(data);
      res.headers.set('X-Trace-Id', traceId);
      if (options?.cors) {
        res.headers.set('Access-Control-Allow-Origin', options.cors.origin ?? '*');
      }
      return res;
    } catch (err: unknown) {
      console.error('Error traceId:', traceId, err);
      const appErr = err instanceof AppError ? err : AppError.internal('Internal server error');
      return fail(appErr, traceId);
    }
  };

  return impl as unknown as
    ((req: NextRequest) => Promise<Response>) &
    ((req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>);
}
