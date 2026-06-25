import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { useNavigate } from "@solidjs/router";
import { For } from "solid-js";
import { css } from "styled-system/css";

// ---- MOCK DATA (hardcoded for the pitch) -----------------------------------
// Replace with: documents query + UIA episode store + semantic search.

const STATS = [
    { num: "47", label: "pages captured this week", hint: "0 saved manually" },
    { num: "6", label: "apps & sites tracked", hint: "passively" },
    { num: "312", label: "sections indexed", hint: "searchable now" },
    { num: "2.1k", label: "minutes of context", hint: "kept, not lost" },
];

// Auto-captured focus episodes — the differentiator vs a bookmark manager.
const EPISODES = [
    { app: "Chrome", title: "pgvector vs. Qdrant for local RAG — Hacker News", at: "9:42 AM", dur: "18m", kind: "web" },
    { app: "Obsidian", title: "Daily note — embeddings pipeline design", at: "10:15 AM", dur: "34m", kind: "doc" },
    { app: "Chrome", title: "Tauri v2 window-state plugin docs", at: "11:03 AM", dur: "12m", kind: "web" },
    { app: "Cursor", title: "memex/apps/desktop/src-tauri/src/db", at: "11:30 AM", dur: "1h 6m", kind: "code" },
    { app: "Slack", title: "#eng — diesel migration thread", at: "1:20 PM", dur: "8m", kind: "chat" },
];

const DOCS = [
    { title: "Continuous Discovery Habits.pdf", type: "PDF", sections: 42, at: "2d ago" },
    { title: "RAG architecture notes.md", type: "Markdown", sections: 16, at: "3d ago" },
    { title: "pgvector performance tuning", type: "Web", sections: 9, at: "5d ago" },
];

const SOURCES = [
    { name: "Chrome", pct: 44 },
    { name: "Cursor", pct: 28 },
    { name: "Obsidian", pct: 18 },
    { name: "Slack", pct: 10 },
];

const RECALLS = [
    "What was that pgvector indexing trick I read Tuesday?",
    "Summarize my notes on the embeddings pipeline.",
    "Which article compared Qdrant and pgvector?",
];

// ---- styles ----------------------------------------------------------------

const page = css({
    flex: "1",
    display: "flex",
    flexDirection: "column",
    px: "7",
    pt: "10",
    pb: "10",
    gap: "8",
    maxW: "5xl",
    mx: "auto",
    w: "full",
});
const brand = css({ fontWeight: "600", fontSize: "md", letterSpacing: "-0.01em", color: "fg.default" });
const sectionTitle = css({ fontSize: "sm", fontWeight: "600", color: "fg.default", mb: "3" });
const card = css({
    borderWidth: "1px",
    borderColor: "border.subtle",
    borderRadius: "l2",
    bg: "bg.subtle",
});
const muted = css({ fontSize: "xs", color: "fg.muted" });

export default function Dashboard() {
    const navigate = useNavigate();
    const logout = async () => {
        await signOut();
        navigate("/login", { replace: true });
    };
    return (
        <main class={page}>
            {/* header */}
            <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
                <div class={brand}>
                    memex<span class={css({ color: "amber.default" })}>.</span>
                </div>
                <div class={css({ display: "flex", alignItems: "center", gap: "4" })}>
                    <span class={muted}>Friday · captured quietly all day</span>
                    <Button variant="ghost" size="sm" onClick={logout}>
                        Sign out
                    </Button>
                </div>
            </div>

            {/* 1. RECALL — the hero */}
            <div>
                <h1 class={css({ fontSize: "2xl", fontWeight: "500", letterSpacing: "-0.02em", color: "fg.default", mb: "1.5" })}>
                    Ask your memory.
                </h1>
                <p class={css({ fontSize: "sm", color: "fg.muted", mb: "4" })}>
                    Everything you read and worked on, searchable in plain language.
                </p>
                <div class={css({ display: "flex", gap: "2.5" })}>
                    <input
                        placeholder="What did I read about local embeddings last week?"
                        class={css({
                            flex: "1",
                            px: "4", py: "3",
                            fontSize: "sm",
                            color: "fg.default",
                            bg: "bg.default",
                            borderWidth: "1px",
                            borderColor: "border.default",
                            borderRadius: "l2",
                            _placeholder: { color: "fg.subtle" },
                            _focus: { outline: "none", borderColor: "amber.default" },
                        })}
                    />
                    <Button size="lg">Recall</Button>
                </div>
                <div class={css({ display: "flex", gap: "2", mt: "3", flexWrap: "wrap" })}>
                    <For each={RECALLS}>
                        {(q) => (
                            <span class={css({
                                fontSize: "xs", color: "fg.muted",
                                px: "2.5", py: "1.5",
                                borderWidth: "1px", borderColor: "border.subtle",
                                borderRadius: "full", cursor: "pointer",
                                _hover: { borderColor: "border.emphasized", color: "fg.default" },
                            })}>
                                {q}
                            </span>
                        )}
                    </For>
                </div>
            </div>

            {/* stat strip — the passive-capture story */}
            <div class={css({ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4" })}>
                <For each={STATS}>
                    {(s) => (
                        <div class={css({ ...cardPad })}>
                            <div class={css({ fontSize: "2xl", fontWeight: "600", color: "amber.default", lineHeight: "1" })}>
                                {s.num}
                            </div>
                            <div class={css({ fontSize: "xs", color: "fg.muted", mt: "1.5", lineHeight: "1.4" })}>
                                {s.label}
                            </div>
                            <div class={css({ fontSize: "2xs", color: "fg.subtle", mt: "0.5" })}>{s.hint}</div>
                        </div>
                    )}
                </For>
            </div>

            {/* 2. ACTIVITY TIMELINE + sources, side by side */}
            <div class={css({ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "6" })}>
                {/* episodes */}
                <div>
                    <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "baseline" })}>
                        <h2 class={sectionTitle}>Today's activity</h2>
                        <span class={muted}>auto-captured</span>
                    </div>
                    <div class={card}>
                        <For each={EPISODES}>
                            {(e, i) => (
                                <div class={css({
                                    display: "flex", alignItems: "center", gap: "3",
                                    px: "4", py: "3",
                                    borderBottomWidth: i() === EPISODES.length - 1 ? "0" : "1px",
                                    borderColor: "border.subtle",
                                })}>
                                    <span class={css({ ...dot })} data-kind={e.kind}>{e.app[0]}</span>
                                    <div class={css({ flex: "1", minW: "0" })}>
                                        <div class={css({ fontSize: "sm", color: "fg.default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>
                                            {e.title}
                                        </div>
                                        <div class={muted}>{e.app} · {e.at}</div>
                                    </div>
                                    <span class={css({ fontSize: "xs", color: "fg.subtle", flexShrink: "0" })}>{e.dur}</span>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* sources */}
                <div>
                    <h2 class={sectionTitle}>Where it comes from</h2>
                    <div class={css({ ...cardPad, display: "flex", flexDirection: "column", gap: "3.5" })}>
                        <For each={SOURCES}>
                            {(s) => (
                                <div>
                                    <div class={css({ display: "flex", justifyContent: "space-between", fontSize: "xs", color: "fg.muted", mb: "1" })}>
                                        <span class={css({ color: "fg.default" })}>{s.name}</span>
                                        <span>{s.pct}%</span>
                                    </div>
                                    <div class={css({ h: "1.5", bg: "bg.muted", borderRadius: "full", overflow: "hidden" })}>
                                        <div class={css({ h: "full", bg: "amber.default", borderRadius: "full" })} style={{ width: `${s.pct}%` }} />
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </div>

            {/* 3. CAPTURED KNOWLEDGE */}
            <div>
                <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "baseline" })}>
                    <h2 class={sectionTitle}>Captured knowledge</h2>
                    <span class={css({ fontSize: "xs", color: "amber.default", cursor: "pointer" })}>View all</span>
                </div>
                <div class={card}>
                    <For each={DOCS}>
                        {(d, i) => (
                            <div class={css({
                                display: "flex", alignItems: "center", gap: "4",
                                px: "4", py: "3.5",
                                borderBottomWidth: i() === DOCS.length - 1 ? "0" : "1px",
                                borderColor: "border.subtle",
                            })}>
                                <span class={css({
                                    fontSize: "2xs", fontWeight: "600", color: "fg.muted",
                                    px: "2", py: "1", borderRadius: "l1", bg: "bg.muted", flexShrink: "0",
                                })}>{d.type}</span>
                                <span class={css({ flex: "1", fontSize: "sm", color: "fg.default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>
                                    {d.title}
                                </span>
                                <span class={muted}>{d.sections} sections</span>
                                <span class={css({ fontSize: "xs", color: "fg.subtle", w: "16", textAlign: "right" })}>{d.at}</span>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </main>
    );
}

// shared style objects spread into css()
const cardPad = {
    borderWidth: "1px",
    borderColor: "border.subtle",
    borderRadius: "l2",
    bg: "bg.subtle",
    px: "4",
    py: "3.5",
} as const;

const dot = {
    flexShrink: "0",
    w: "7", h: "7",
    borderRadius: "full",
    display: "grid",
    placeItems: "center",
    fontSize: "xs",
    fontWeight: "600",
    bg: "amber.a2",
    color: "amber.default",
} as const;
