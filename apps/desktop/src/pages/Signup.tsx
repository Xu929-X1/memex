import { AuthLayout, authLink } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { register } from "@/lib/api";
import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { css } from "styled-system/css";

export default function Signup() {
    const navigate = useNavigate();
    const [email, setEmail] = createSignal("");
    const [username, setUsername] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [error, setError] = createSignal("");
    const [loading, setLoading] = createSignal(false);

    const onSubmit = async (e: SubmitEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await register(email(), username(), password());
            // TODO(auth): persist token in keychain, then continue onboarding
            navigate("/setup");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign up failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Create account."
            subtitle="Start building your second memory."
            footer={
                <>
                    Already have one?{" "}
                    <A href="/login" class={authLink}>
                        Sign in
                    </A>
                </>
            }
        >
            <form
                onSubmit={onSubmit}
                class={css({ display: "flex", flexDirection: "column", gap: "5" })}
            >
                <TextField
                    label="Email"
                    type="email"
                    autocomplete="email"
                    placeholder="you@example.com"
                    required
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                />
                <TextField
                    label="Username"
                    type="text"
                    autocomplete="username"
                    placeholder="yourname"
                    required
                    value={username()}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                />
                <TextField
                    label="Password"
                    type="password"
                    autocomplete="new-password"
                    placeholder="at least 8 characters"
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
                    {loading() ? "Creating…" : "Create account"}
                </Button>
            </form>
        </AuthLayout>
    );
}
