import { searchMemory, type RelatedMemory } from "@/lib/api";
import { token } from "@/lib/auth";
import { listen } from "@tauri-apps/api/event";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { css } from "styled-system/css";

type SelectionEvent = { text: string };

export default function Hud() {
    const [results, setResults] = createSignal<RelatedMemory[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [query, setQuery] = createSignal("");
    // Guards against out-of-order responses: only the latest request renders.
    let reqId = 0;

    async function recall(text: string) {
        const t = token();
        if (!t) return;
        const id = ++reqId;
        setQuery(text);
        setLoading(true);
        try {
            const found = await searchMemory(text, t);
            if (id === reqId) setResults(found);
        } catch {
            if (id === reqId) setResults([]);
        } finally {
            if (id === reqId) setLoading(false);
        }
    }

    onMount(async () => {
        document.body.style.background = "transparent";
        const un = await listen<SelectionEvent>("selection", (e) => {
            void recall(e.payload.text);
        });
        onCleanup(un);
    });

    return (
        <div
            class={css({
                m: "2",
                p: "3",
                borderRadius: "l2",
                bg: "bg.default",
                borderWidth: "1px",
                borderColor: "border.default",
                boxShadow: "lg",
                display: "flex",
                flexDirection: "column",
                gap: "2.5",
            })}
        >
            {/* header */}
            <div class={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
                <span class={css({ fontWeight: "600", fontSize: "xs", color: "fg.default" })}>
                    memex<span class={css({ color: "amber.default" })}>.</span>
                </span>
                <span class={css({ fontSize: "2xs", color: "fg.subtle" })}>
                    <Show when={!loading()} fallback="searching…">
                        {results().length} related in your memory
                    </Show>
                </span>
            </div>

            {/* results */}
            <Show
                when={results().length > 0}
                fallback={
                    <p class={css({ fontSize: "2xs", color: "fg.subtle", py: "1" })}>
                        <Show when={!loading()} fallback="">
                            Nothing related captured yet.
                        </Show>
                    </p>
                }
            >
                <div class={css({ display: "flex", flexDirection: "column" })}>
                    <For each={results().slice(0, 3)}>
                        {(r, i) => (
                            <div
                                class={css({
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.5",
                                    py: "2",
                                    borderBottomWidth: i() === Math.min(results().length, 3) - 1 ? "0" : "1px",
                                    borderColor: "border.subtle",
                                    cursor: "pointer",
                                    _hover: { "& .title": { color: "amber.default" } },
                                })}
                            >
                                <span
                                    class={`title ${css({
                                        fontSize: "xs",
                                        fontWeight: "medium",
                                        color: "fg.default",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    })}`}
                                >
                                    {r.documentTitle}
                                </span>
                                <span
                                    class={css({
                                        fontSize: "2xs",
                                        color: "fg.muted",
                                        lineHeight: "1.4",
                                        lineClamp: "2",
                                    })}
                                >
                                    {r.sectionContent}
                                </span>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* footer action */}
            <Show when={query()}>
                <button
                    class={css({
                        fontSize: "2xs",
                        fontWeight: "medium",
                        color: "amber.default",
                        alignSelf: "flex-start",
                        cursor: "pointer",
                        bg: "transparent",
                        _hover: { textDecoration: "underline" },
                    })}
                >
                    Ask about this →
                </button>
            </Show>
        </div>
    );
}
