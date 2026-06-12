import { Button } from "@/components/ui/button";
import { useNavigate } from "@solidjs/router";
import { For } from "solid-js";
import { css } from "styled-system/css";

const page = css({
    flex: "1",
    display: "flex",
    flexDirection: "column",
    px: "7",
    pt: "14",
    pb: "10",
    gap: "10",
    animation: "fade 0.5s ease both",
});

const brand = css({
    fontWeight: "600",
    fontSize: "md",
    letterSpacing: "-0.01em",
    color: "fg.default",
});

const hero = css({
    fontWeight: "500",
    fontSize: "3xl",
    lineHeight: "1.2",
    letterSpacing: "-0.02em",
    color: "fg.default",
});

const stats = css({
    display: "flex",
    gap: "6",
    pt: "6",
    borderTopWidth: "1px",
    borderColor: "border.subtle",
});

const statNum = css({
    fontWeight: "600",
    fontSize: "2xl",
    lineHeight: "1",
    color: "amber.default",
});

const statLabel = css({
    fontSize: "xs",
    lineHeight: "1.4",
    color: "fg.muted",
    mt: "1.5",
});

const para = css({
    fontSize: "sm",
    lineHeight: "1.7",
    color: "fg.muted",
});

const actions = css({
    display: "flex",
    flexDirection: "column",
    gap: "2.5",
});

const STATS = [
    { num: "~20%", label: "of work time re-finding info" },
    { num: "50%", label: "forgotten within an hour" },
    { num: "70%", label: "gone within a day" },
];

export default function Home() {
    const navigate = useNavigate();
    return (
        <main class={page}>
            <div class={brand}>
                memex<span class={css({ color: "amber.default" })}>.</span>
            </div>

            <h1 class={hero}>
                Your computer stores files.{" "}
                <span class={css({ color: "fg.muted" })}>
                    Memex stores knowledge.
                </span>
            </h1>

            <div class={stats}>
                <For each={STATS}>
                    {(s) => (
                        <div class={css({ flex: "1" })}>
                            <div class={statNum}>{s.num}</div>
                            <div class={statLabel}>{s.label}</div>
                        </div>
                    )}
                </For>
            </div>

            <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
                <p class={para}>
                    Bookmarks pile up. Note apps demand effort. Tags multiply. But
                    when you need something, you still can't remember where you
                    read it.
                </p>
                <p class={para}>
                    Memex captures quietly as you browse, preserving context
                    alongside content. When you need it, semantic search brings it
                    back.
                </p>
            </div>

            <div class={actions}>
                <Button size="lg" onClick={() => navigate("/login")}>
                    Sign in
                </Button>
                <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/signup")}
                >
                    Create account
                </Button>
            </div>

            <p
                class={css({
                    fontSize: "xs",
                    color: "fg.subtle",
                    textAlign: "center",
                })}
            >
                What you've read stays yours.
            </p>
        </main>
    );
}
