import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { fetchDocuments } from '../lib/api';
import Settings from './Settings';
interface DashboardProps {
  onSignOut: () => Promise<void> | void;
}
type DashboardMode = 'doc' | 'setting';

export default function Dashboard({ onSignOut }: DashboardProps) {
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('doc');

  async function handleFetchDocs() {
    setError(null);
    setLoadingDocs(true);
    try {
      const docs = await fetchDocuments();
      setDocCount(docs.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-80 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="text-sm font-semibold tracking-tight">memex</div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut}>
          Sign out
        </Button>
      </header>

      <div className="flex border-b">
        <TabButton
          active={dashboardMode === 'doc'}
          onClick={() => setDashboardMode('doc')}
        >
          Docs
        </TabButton>
        <TabButton
          active={dashboardMode === 'setting'}
          onClick={() => setDashboardMode('setting')}
        >
          Settings
        </TabButton>
      </div>

      <main className="flex flex-col gap-3 p-4">
        {dashboardMode === 'doc' && (
          <>
            <Card>
              <CardContent className="p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </div>
                <div className="text-sm font-medium text-emerald-500">Connected</div>
              </CardContent>
            </Card>
            <Button onClick={handleFetchDocs} disabled={loadingDocs}>
              {loadingDocs && <Loader2 className="animate-spin" />}
              {loadingDocs ? 'Loading…' : 'Fetch documents'}
            </Button>
            {docCount !== null && (
              <div className="text-center text-xs text-muted-foreground">
                {docCount} document{docCount === 1 ? '' : 's'}
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </>
        )}

        {dashboardMode === 'setting' && <Settings />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-3 py-2 text-xs font-medium transition-colors',
        active
          ? 'border-b-2 border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
