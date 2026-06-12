import { For, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";

const page = css({
    flex: "1",
    display: "flex",
    flexDirection: "column",
    px: "7",
    pt: "9",
    pb: "8",
    minH: "100vh",
    animation: "fade 0.4s ease both",
});

const brand = css({
    fontWeight: "600",
    fontSize: "sm",
    letterSpacing: "-0.01em",
    color: "fg.default",
});

const progress = css({
    display: "flex",
    gap: "1.5",
    mt: "5",
});

const seg = (active: boolean) =>
    css({
        h: "0.5",
        flex: "1",
        borderRadius: "full",
        bg: active ? "amber.default" : "border.default",
        transition: "background 0.3s",
    });

const stepText = css({
    fontSize: "xs",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "fg.muted",
    mt: "4",
});

const title = css({
    fontWeight: "500",
    fontSize: "2xl",
    lineHeight: "1.2",
    letterSpacing: "-0.02em",
    color: "fg.default",
    mt: "1.5",
});

const subtitle = css({
    fontSize: "sm",
    lineHeight: "1.6",
    color: "fg.muted",
    mt: "2",
});

const body = css({
    mt: "7",
    display: "flex",
    flexDirection: "column",
    gap: "4",
});

const footer = css({
    mt: "auto",
    pt: "8",
    display: "flex",
    flexDirection: "column",
    gap: "3",
});

export function OnboardingLayout(props: {
    step?: number;
    total?: number;
    title: string;
    subtitle?: string;
    children: JSX.Element;
    footer: JSX.Element;
}) {
    return (
        <main class={page}>
            <div class={brand}>
                memex<span class={css({ color: "amber.default" })}>.</span>
            </div>

            <Show when={props.step && props.total}>
                <div class={progress}>
                    <For each={Array.from({ length: props.total! })}>
                        {(_, i) => <span class={seg(i() < props.step!)} />}
                    </For>
                </div>
                <div class={stepText}>
                    Step {props.step} of {props.total}
                </div>
            </Show>

            <h1 class={title}>{props.title}</h1>
            <Show when={props.subtitle}>
                <p class={subtitle}>{props.subtitle}</p>
            </Show>

            <div class={body}>{props.children}</div>

            <div class={footer}>{props.footer}</div>
        </main>
    );
}
