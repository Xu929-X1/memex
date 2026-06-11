import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { css } from "styled-system/css";

const page = css({
    flex: "1",
    display: "flex",
    flexDirection: "column",
    px: "7",
    pt: "8",
    pb: "8",
});

const back = css({
    display: "inline-flex",
    alignItems: "center",
    gap: "1.5",
    fontSize: "sm",
    color: "fg.muted",
    width: "fit-content",
    transition: "color 0.18s",
    _hover: { color: "fg.default" },
});

const wordmark = css({
    fontWeight: "600",
    fontSize: "md",
    letterSpacing: "-0.01em",
    color: "fg.default",
    mt: "10",
});

const heading = css({
    fontWeight: "500",
    fontSize: "3xl",
    lineHeight: "1.15",
    letterSpacing: "-0.02em",
    color: "fg.default",
    mt: "2",
});

const subtitle = css({
    fontSize: "sm",
    color: "fg.muted",
    mt: "2.5",
});

const body = css({
    mt: "8",
    display: "flex",
    flexDirection: "column",
    gap: "5",
});

export function AuthLayout(props: {
    title: string;
    subtitle: string;
    children: JSX.Element;
    footer: JSX.Element;
}) {
    return (
        <main class={page}>
            <A href="/" class={back}>
                ← back
            </A>

            <div class={wordmark}>
                memex<span class={css({ color: "amber.default" })}>.</span>
            </div>
            {/* brand period kept as the single deliberate accent */}
            <h1 class={heading}>{props.title}</h1>
            <p class={subtitle}>{props.subtitle}</p>

            <div class={body}>{props.children}</div>

            <div
                class={css({
                    mt: "auto",
                    pt: "8",
                    fontSize: "sm",
                    color: "fg.muted",
                    textAlign: "center",
                })}
            >
                {props.footer}
            </div>
        </main>
    );
}

export const authLink = css({
    color: "amber.default",
    fontWeight: "medium",
    _hover: { textDecoration: "underline" },
});
