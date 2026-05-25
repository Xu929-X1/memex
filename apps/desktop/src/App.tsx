import { createSignal, onMount, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

type SyncStats = {
  pages: number;
  rows: number;
  lastCursor: string | null;
};

export function App() {
  const [baseUrl, setBaseUrl] = createSignal("");
  const [authToken, setAuthToken] = createSignal("");
  const [count, setCount] = createSignal<number | null>(null);
  const [status, setStatus] = createSignal<string>("");
  const [busy, setBusy] = createSignal(false);

  async function refreshCount() {
    try {
      const n = await invoke<number>("pending_count");
      setCount(n);
    } catch (e) {
      setStatus(`count error: ${e}`);
    }
  }

  onMount(refreshCount);

  async function saveAuth() {
    setBusy(true);
    setStatus("saving auth…");
    try {
      await invoke("set_auth", { baseUrl: baseUrl(), authToken: authToken() });
      setStatus("auth saved");
    } catch (e) {
      setStatus(`auth error: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function doSync() {
    setBusy(true);
    setStatus("syncing…");
    try {
      const stats = await invoke<SyncStats>("sync_now");
      setStatus(`sync ok: ${stats.rows} rows over ${stats.pages} pages`);
      await refreshCount();
    } catch (e) {
      setStatus(`sync error: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ "font-family": "system-ui, sans-serif", padding: "16px", color: "#eee", background: "#111", "min-height": "100vh" }}>
      <h1 style={{ "font-size": "18px", margin: "0 0 12px" }}>memex desktop</h1>
      <p style={{ color: "#999", "margin-top": 0 }}>
        local corpus replica for "this looks like B"
      </p>

      <section style={{ "margin-bottom": "16px" }}>
        <label style={{ display: "block", "font-size": "12px", "margin-bottom": "4px" }}>memex base URL</label>
        <input
          value={baseUrl()}
          onInput={(e) => setBaseUrl(e.currentTarget.value)}
          placeholder="https://memex.example.com"
          style={{ width: "100%", padding: "6px", "box-sizing": "border-box" }}
        />
        <label style={{ display: "block", "font-size": "12px", "margin-top": "8px", "margin-bottom": "4px" }}>auth_token (JWT)</label>
        <input
          value={authToken()}
          onInput={(e) => setAuthToken(e.currentTarget.value)}
          type="password"
          style={{ width: "100%", padding: "6px", "box-sizing": "border-box" }}
        />
        <button onClick={saveAuth} disabled={busy()} style={{ "margin-top": "8px" }}>
          save auth
        </button>
      </section>

      <section style={{ "margin-bottom": "16px" }}>
        <button onClick={doSync} disabled={busy()}>sync now</button>
        <button onClick={refreshCount} disabled={busy()} style={{ "margin-left": "8px" }}>refresh count</button>
      </section>

      <Show when={count() !== null}>
        <p>local sections: {count()}</p>
      </Show>
      <Show when={status() !== ""}>
        <pre style={{ background: "#222", padding: "8px", "white-space": "pre-wrap" }}>{status()}</pre>
      </Show>
    </main>
  );
}
