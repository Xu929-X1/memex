import { CLIENT_HEADER, CLIENTS } from "@memex/shared";
import { fetch } from "@tauri-apps/plugin-http";

// Talks to the @memex/web API. Override in dev via VITE_API_BASE.
const API_BASE = (
    import.meta.env.VITE_API_BASE ?? "https://memex.up.railway.app"
).replace(/\/+$/, "");

async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}/api/v1/${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            [CLIENT_HEADER]: CLIENTS.desktop,
        },
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
    return post<AuthUser>("auth/desktop/login", { identifier, password });
}

export function register(email: string, username: string, password: string) {
    return post<AuthUser>("auth/desktop/register", { email, username, password });
}

// TODO(auth): persist `user.token` in the OS keychain via a Tauri command
// (invoke("save_token", { token })) and send it as `Authorization: Bearer`.
