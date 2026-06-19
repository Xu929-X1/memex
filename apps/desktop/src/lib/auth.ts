import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import { tokenHealthCheck, type AuthUser } from "./api";

// Global auth state. `ready` flips true once the startup token check finishes —
// guards must wait for it, otherwise they'd bounce a logged-in user to /login
// during the brief async read.
const [token, setToken] = createSignal<string | null>(null);
const [user, setUser] = createSignal<AuthUser | null>(null);
const [ready, setReady] = createSignal(false);

export { ready, token, user };

export const isAuthed = () => token() !== null;

// Call once at startup: load the persisted token from SQLite (get_token command).
export async function bootstrapAuth(): Promise<void> {
    try {
        const stored = await invoke<string | null>("get_token");
        if(stored === null){
            setToken(null);
            return;
        }
        const checkResult = await tokenHealthCheck(stored);
        setToken(checkResult ? stored : null);
    } catch (e) {
        console.error("auth bootstrap failed", e);
        setToken(null);
    } finally {
        setReady(true);
    }
}

// Persist + set in-memory state after a successful login/register.
export async function signIn(t: string, u: AuthUser): Promise<void> {
    await invoke("save_auth", {
        token: t,
        user: { id: u.id, email: u.email, username: u.username ?? null },
    });
    setToken(t);
    setUser(u);
}

export async function signOut(): Promise<void> {
    await invoke("delete_token");
    setToken(null);
    setUser(null);
}
