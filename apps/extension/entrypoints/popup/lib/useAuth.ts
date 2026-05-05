import { useCallback, useEffect, useState } from 'react';
import { isAuthed, logout as apiLogout } from './api';

export type AuthState =
  | { kind: 'loading' }
  | { kind: 'authed' }
  | { kind: 'anon' };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ kind: 'loading' });

  const refresh = useCallback(async () => {
    const ok = await isAuthed();
    setState({ kind: ok ? 'authed' : 'anon' });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setState({ kind: 'anon' });
  }, []);

  return { state, refresh, signOut };
}
