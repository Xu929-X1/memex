import { BEARER_HEADER, BEARER_PREFIX, CLIENT_HEADER, CLIENTS } from "@memex/shared";
import { fetch } from "@tauri-apps/plugin-http";

export type APIEnvelopeType<T> = {
    data: T,
    success: boolean
}

export type HeaderType = {
    "Content-Type": string,
    [CLIENT_HEADER]: typeof CLIENTS[keyof typeof CLIENTS],
    [BEARER_HEADER]?: string
}
// "https://memex.up.railway.app"
// Talks to the @memex/web API. Override in dev via VITE_API_BASE.
const API_BASE = (
    import.meta.env.VITE_API_BASE ?? "http://localhost:3000"
).replace(/\/+$/, "");

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
    const headers: HeaderType = {
            "Content-Type": "application/json",
            [CLIENT_HEADER]: CLIENTS.desktop,
        };

    if(token){
        headers[BEARER_HEADER] = `${BEARER_PREFIX}${token}`
    }
    const res = await fetch(`${API_BASE}/api/v1/${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message ?? data?.message ?? "Request failed");
    }
    return data as T;
}

export type AuthUser = {
    id: string;
    email: string;
    username?: string;
    token?: string;
};


export function login(identifier: string, password: string) {
    return post<APIEnvelopeType<AuthUser>>("auth/desktop/login", { identifier, password });
}

export function register(email: string, username: string, password: string) {
    return post<APIEnvelopeType<AuthUser>>("auth/desktop/register", { email, username, password });
}

export function tokenHealthCheck(token: string){
    return post("auth/desktop/me", {}, token);
}

// TODO(auth): persist `user.token` in the OS keychain via a Tauri command
// (invoke("save_token", { token })) and send it as `Authorization: Bearer`.
