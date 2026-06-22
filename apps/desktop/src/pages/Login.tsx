import { AuthLayout, authLink } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { login } from "@/lib/api";
import { signIn } from "@/lib/auth";
import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { css } from "styled-system/css";


export default function Login() {
    const navigate = useNavigate();
    const [identifier, setIdentifier] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [error, setError] = createSignal("");
    const [loading, setLoading] = createSignal(false);

    const onSubmit = async (e: SubmitEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await login(identifier(), password());
            if (!res.data.token) throw new Error("No token returned");
            await signIn(res.data.token, res.data);
            // Returning user → straight to the app.
            navigate("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign in failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Welcome back."
            subtitle="Sign in to your second memory."
            footer={
                <>
                    New here?{" "}
                    <A href="/signup" class={authLink}>
                        Create an account
                    </A>
                </>
            }
        >
            <form
                onSubmit={onSubmit}
                class={css({ display: "flex", flexDirection: "column", gap: "5" })}
            >
                <TextField
                    label="Email or username"
                    type="text"
                    autocomplete="username"
                    placeholder="you@example.com"
                    required
                    value={identifier()}
                    onInput={(e) => setIdentifier(e.currentTarget.value)}
                />
                <TextField
                    label="Password"
                    type="password"
                    autocomplete="current-password"
                    placeholder="••••••••"
                    required
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                />

                <Show when={error()}>
                    <p class={css({ fontSize: "sm", color: "red.default" })}>
                        {error()}
                    </p>
                </Show>

                <Button type="submit" size="lg" disabled={loading()}>
                    {loading() ? "Signing in…" : "Sign in"}
                </Button>
            </form>
        </AuthLayout>
    );
}
