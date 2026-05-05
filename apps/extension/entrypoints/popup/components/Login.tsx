import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { login } from '../lib/api';

interface LoginProps {
  onAuthed: () => Promise<void> | void;
}

export default function Login({ onAuthed }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(identifier, password);
      setPassword('');
      await onAuthed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[320px] flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="text-sm font-semibold tracking-tight">memex</div>
      </header>
      <main className="flex flex-col gap-4 p-4">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identifier">Email or username</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </main>
    </div>
  );
}
