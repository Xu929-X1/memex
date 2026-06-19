import { OnboardingLayout } from "@/components/onboarding-layout";
import { Button } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/option-card";
import { TextField } from "@/components/ui/text-field";
import { useNavigate } from "@solidjs/router";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import { css } from "styled-system/css";

type Provider = "ollama" | "openai" | "cloud";

const TOTAL = 4;

const row = css({ display: "flex", gap: "2.5" });
const note = css({
    fontSize: "xs",
    lineHeight: "1.6",
    color: "fg.subtle",
    bg: "bg.subtle",
    borderWidth: "1px",
    borderColor: "border.subtle",
    borderRadius: "l2",
    px: "3.5",
    py: "3",
});
const cards = css({ display: "flex", flexDirection: "column", gap: "2.5" });

export default function Setup() {
    const navigate = useNavigate();
    const [step, setStep] = createSignal(0);

    const [dataDir, setDataDir] = createSignal(
        "C:\\Users\\you\\Documents\\memex",
    );
    const [provider, setProvider] = createSignal<Provider>("ollama");
    const [endpoint, setEndpoint] = createSignal("http://localhost:11434");
    const [model, setModel] = createSignal("llama3.1:8b");
    const [embed, setEmbed] = createSignal("nomic-embed-text");

    const next = () => setStep((s) => Math.min(s + 1, TOTAL));
    const back = () => (step() === 0 ? navigate("/") : setStep((s) => s - 1));
    const finish = () => navigate("/");

    const NavBack = () => (
        <Button variant="ghost" size="lg" onClick={back}>
            Back
        </Button>
    );

    return (
        <Switch>
            {/* ---- Welcome ---- */}
            <Match when={step() === 0}>
                <OnboardingLayout
                    title="Set up memex."
                    subtitle="A few quick choices about where your memory lives and which model reads it. Everything runs locally by default."
                    footer={
                        <>
                            <Button size="lg" onClick={next}>
                                Get started
                            </Button>
                            <Button
                                variant="ghost"
                                size="lg"
                                onClick={() => navigate("/")}
                            >
                                Maybe later
                            </Button>
                        </>
                    }
                >
                    <div class={cards}>
                        <For
                            each={[
                                "Pick where your data is stored",
                                "Choose a local or cloud model",
                                "Select an embedding model for search",
                            ]}
                        >
                            {(t, i) => (
                                <div
                                    class={css({
                                        display: "flex",
                                        gap: "3",
                                        alignItems: "center",
                                        fontSize: "sm",
                                        color: "fg.muted",
                                    })}
                                >
                                    <span
                                        class={css({
                                            w: "6",
                                            h: "6",
                                            flexShrink: "0",
                                            display: "grid",
                                            placeItems: "center",
                                            borderRadius: "full",
                                            bg: "amber.a2",
                                            color: "amber.default",
                                            fontSize: "xs",
                                            fontWeight: "600",
                                        })}
                                    >
                                        {i() + 1}
                                    </span>
                                    {t}
                                </div>
                            )}
                        </For>
                    </div>
                </OnboardingLayout>
            </Match>

            {/* ---- Storage / local DB ---- */}
            <Match when={step() === 1}>
                <OnboardingLayout
                    step={1}
                    total={TOTAL}
                    title="Where should memex live?"
                    subtitle="Your documents and their vectors are stored locally in an embedded pgvector database."
                    footer={
                        <>
                            <Button size="lg" onClick={next}>
                                Continue
                            </Button>
                            <NavBack />
                        </>
                    }
                >
                    <TextField
                        label="Data folder"
                        value={dataDir()}
                        onInput={(e) => setDataDir(e.currentTarget.value)}
                    />
                    <div class={row}>
                        <Button variant="outline" size="md" onClick={() => {
                            //Open
                        }}>
                            Browse…
                        </Button>
                    </div>
                    <p class={note}>
                        Roughly 1–2 GB for a few thousand documents. You can move
                        this later in Settings.
                    </p>
                </OnboardingLayout>
            </Match>

            {/* ---- Local model ---- */}
            <Match when={step() === 2}>
                <OnboardingLayout
                    step={2}
                    total={TOTAL}
                    title="Which model reads your library?"
                    subtitle="memex uses a language model to structure and answer over what you capture."
                    footer={
                        <>
                            <Button size="lg" onClick={next}>
                                Continue
                            </Button>
                            <NavBack />
                        </>
                    }
                >
                    <div class={cards}>
                        <OptionCard
                            title="Ollama (local)"
                            description="Runs entirely on this machine. Private, no API key."
                            selected={provider() === "ollama"}
                            onSelect={() => setProvider("ollama")}
                        />
                        <OptionCard
                            title="OpenAI-compatible"
                            description="Point at any OpenAI-style endpoint with your own key."
                            selected={provider() === "openai"}
                            onSelect={() => setProvider("openai")}
                        />
                        <OptionCard
                            title="memex Cloud"
                            description="Managed models. Nothing to install or configure."
                            selected={provider() === "cloud"}
                            onSelect={() => setProvider("cloud")}
                        />
                    </div>

                    <Show when={provider() !== "cloud"}>
                        <TextField
                            label="Endpoint"
                            value={endpoint()}
                            onInput={(e) => setEndpoint(e.currentTarget.value)}
                        />
                        <TextField
                            label="Model"
                            value={model()}
                            onInput={(e) => setModel(e.currentTarget.value)}
                        />
                    </Show>
                    <Show when={provider() === "openai"}>
                        <TextField
                            label="API key"
                            type="password"
                            placeholder="sk-…"
                        />
                    </Show>
                </OnboardingLayout>
            </Match>

            {/* ---- Embeddings ---- */}
            <Match when={step() === 3}>
                <OnboardingLayout
                    step={3}
                    total={TOTAL}
                    title="How should memex search?"
                    subtitle="An embedding model turns your text into vectors so semantic search can find it."
                    footer={
                        <>
                            <Button size="lg" onClick={next}>
                                Continue
                            </Button>
                            <NavBack />
                        </>
                    }
                >
                    <div class={cards}>
                        <OptionCard
                            title="nomic-embed-text"
                            description="Local · 768 dims · great default for most libraries."
                            selected={embed() === "nomic-embed-text"}
                            onSelect={() => setEmbed("nomic-embed-text")}
                        />
                        <OptionCard
                            title="all-MiniLM-L6-v2"
                            description="Local · 384 dims · lightest, fastest to index."
                            selected={embed() === "all-MiniLM-L6-v2"}
                            onSelect={() => setEmbed("all-MiniLM-L6-v2")}
                        />
                        <OptionCard
                            title="text-embedding-3-small"
                            description="Cloud · 1536 dims · highest quality, needs a key."
                            selected={embed() === "text-embedding-3-small"}
                            onSelect={() => setEmbed("text-embedding-3-small")}
                        />
                    </div>
                </OnboardingLayout>
            </Match>

            {/* ---- Review / done ---- */}
            <Match when={step() === 4}>
                <OnboardingLayout
                    step={4}
                    total={TOTAL}
                    title="You're all set."
                    subtitle="Review your choices — you can change any of these later in Settings."
                    footer={
                        <>
                            <Button size="lg" onClick={finish}>
                                Finish setup
                            </Button>
                            <NavBack />
                        </>
                    }
                >
                    <div
                        class={css({
                            display: "flex",
                            flexDirection: "column",
                            borderWidth: "1px",
                            borderColor: "border.subtle",
                            borderRadius: "l2",
                            overflow: "hidden",
                        })}
                    >
                        <For
                            each={[
                                { k: "Data folder", v: dataDir() },
                                {
                                    k: "Model",
                                    v:
                                        provider() === "cloud"
                                            ? "memex Cloud"
                                            : `${model()} · ${provider()}`,
                                },
                                { k: "Embeddings", v: embed() },
                            ]}
                        >
                            {(r) => (
                                <div
                                    class={css({
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: "4",
                                        px: "4",
                                        py: "3",
                                        fontSize: "sm",
                                        borderBottomWidth: "1px",
                                        borderColor: "border.subtle",
                                        _last: { borderBottomWidth: "0" },
                                    })}
                                >
                                    <span class={css({ color: "fg.muted" })}>
                                        {r.k}
                                    </span>
                                    <span
                                        class={css({
                                            color: "fg.default",
                                            fontWeight: "medium",
                                            textAlign: "right",
                                            wordBreak: "break-all",
                                        })}
                                    >
                                        {r.v}
                                    </span>
                                </div>
                            )}
                        </For>
                    </div>
                </OnboardingLayout>
            </Match>
        </Switch>
    );
}
