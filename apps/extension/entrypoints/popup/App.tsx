import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import './App.css';

const API = import.meta.env.WXT_API_URL;
async function login(identifier: string, password: string) {
  const r = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error?.message ?? 'Login failed');
  }
  return r.json();
}

async function logout() {
  await fetch(`${API}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

async function isAuthed() {
  const c = await browser.cookies.get({ url: API, name: 'auth_token' });
  return !!c;
}

async function authedFetch(path: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, { ...init, credentials: 'include' });
}

function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    isAuthed().then(setAuthed);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(id, pw);
      setAuthed(await isAuthed());
      setPw('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    await logout();
    setAuthed(false);
    setDocCount(null);
    setBusy(false);
  }

  async function onFetchDocs() {
    setBusy(true);
    const r = await authedFetch('/api/v1/documents');
    const body = await r.json();
    setDocCount(Array.isArray(body?.data) ? body.data.length : 0);
    setBusy(false);
  }

  if (authed === null) {
    return (
      <div className="shell">
        <div className="spinner" />
      </div>
    );
  }

  if (authed) {
    return (
      <div className="shell">
        <header className="header">
          <div className="brand">memex</div>
          <button className="ghost" onClick={onLogout} disabled={busy}>
            Sign out
          </button>
        </header>
        <main className="main">
          <div className="card">
            <div className="label">Status</div>
            <div className="value ok">Connected</div>
          </div>
          <button className="primary" onClick={onFetchDocs} disabled={busy}>
            {busy ? 'Loading…' : 'Fetch documents'}
          </button>
          {docCount !== null && (
            <div className="hint">{docCount} document{docCount === 1 ? '' : 's'}</div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="header">
        <div className="brand">memex</div>
      </header>
      <main className="main">
        <div className="title">Sign in</div>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>Email or username</span>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {err && <div className="error">{err}</div>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;
