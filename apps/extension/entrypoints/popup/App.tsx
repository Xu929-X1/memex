import Dashboard from './components/Dashboard';
import Loading from './components/Loading';
import Login from './components/Login';
import { useAuth } from './lib/useAuth';

export default function App() {
  const { state, refresh, signOut } = useAuth();

  if (state.kind === 'loading') return <Loading />;
  if (state.kind === 'anon') return <Login onAuthed={refresh} />;
  return <Dashboard onSignOut={signOut} />;
}
