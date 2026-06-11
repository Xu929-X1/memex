// Talks to the @memex/web API. Override in dev via VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}/api/v1/${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // signals the web API to also return the JWT in the body
            // (cookie auth is unreachable from the Tauri webview)
            "X-Client": "desktop",
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
    // present only once the web API returns the token in-body for desktop
    token?: string;
};

export function login(identifier: string, password: string) {
    return post<AuthUser>("auth/login", { identifier, password });
}

export function register(email: string, username: string, password: string) {
    return post<AuthUser>("auth/register", { email, username, password });
}

// TODO(auth): persist `user.token` in the OS keychain via a Tauri command
// (invoke("save_token", { token })) and send it as `Authorization: Bearer`.
