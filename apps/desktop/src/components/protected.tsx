import { isAuthed, ready } from "@/lib/auth";
import { useNavigate } from "@solidjs/router";
import { createEffect, JSX, Show } from "solid-js";

// Wrap protected routes. Waits for the startup token check (`ready`), then
// redirects guests to /login. Renders children only when authenticated.
export function Protected(props: { children: JSX.Element }) {
    const navigate = useNavigate();
    createEffect(() => {
        if (ready() && !isAuthed()) navigate("/login", { replace: true });
    });
    return <Show when={ready() && isAuthed()}>{props.children}</Show>;
}
