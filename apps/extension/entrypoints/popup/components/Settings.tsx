import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookmarkPlus, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import {
  ExtensionPreference,
  getPreference,
  updatePreference,
} from '../lib/api';
export const SYNC_SITE_MESSAGE = "SYNC_SITE";

function normalizeDomain(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  try {
    const u = new URL(v.includes('://') ? v : `https://${v}`);
    return u.hostname || null;
  } catch {
    return null;
  }
}

interface BookmarkNode {
  url?: string;
  children?: BookmarkNode[];
}

async function readBookmarkHosts(): Promise<string[]> {
  const api = (browser as unknown as {
    bookmarks?: { getTree: () => Promise<BookmarkNode[]> };
  }).bookmarks;
  if (!api) throw new Error('Bookmarks permission unavailable');

  const tree = await api.getTree();
  const urls: string[] = [];
  const walk = (nodes: BookmarkNode[]) => {
    for (const n of nodes) {
      if (n.url) urls.push(n.url);
      if (n.children) walk(n.children);
    }
  };
  walk(tree);
  const hosts = new Set<string>();
  for (const u of urls) {
    try {
      const h = new URL(u).hostname;
      if (h) hosts.add(h);
    } catch {
      // skip bad urls
    }
  }
  return [...hosts];
}

export default function Settings() {
  const [pref, setPref] = useState<ExtensionPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getPreference();
        if (!cancelled) setPref(p);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedURLs = useMemo(
    () => [...(pref?.trackURLs ?? [])].sort(),
    [pref?.trackURLs],
  );

  async function persist(patch: Partial<ExtensionPreference>) {
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const next = await updatePreference(patch);
      setPref(next);
      browser.runtime.sendMessage(SYNC_SITE_MESSAGE);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleTrackAll(checked: boolean) {
    if (!pref) return;
    setPref({ ...pref, trackAllActivities: checked });
    await persist({ trackAllActivities: checked });
  }

  async function handleAddDomain() {
    if (!pref) return;
    const host = normalizeDomain(domainInput);
    if (!host) {
      setError('Enter a valid domain');
      return;
    }
    if (pref.trackURLs.includes(host)) {
      setError(`${host} already tracked`);
      return;
    }
    setDomainInput('');
    await persist({ trackURLs: [...pref.trackURLs, host] });
  }

  async function handleRemoveDomain(host: string) {
    if (!pref) return;
    await persist({ trackURLs: pref.trackURLs.filter((d) => d !== host) });
  }

  async function handleImportBookmarks() {
    if (!pref) return;
    setError(null);
    setInfo(null);
    setImporting(true);
    try {
      const hosts = await readBookmarkHosts();
      const merged = Array.from(new Set([...pref.trackURLs, ...hosts]));
      const added = merged.length - pref.trackURLs.length;
      const next = await updatePreference({ trackURLs: merged });
      setPref(next);
      setInfo(
        added === 0
          ? 'Bookmarks already covered'
          : `Added ${added} domain${added === 1 ? '' : 's'} from bookmarks`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pref) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? 'Failed to load preferences'}</AlertDescription>
      </Alert>
    );
  }

  const trackAll = pref.trackAllActivities;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={trackAll}
          disabled={saving}
          onChange={(e) => handleToggleTrackAll(e.target.checked)}
        />
        <span className="font-medium">Track all activity</span>
        {saving && <Loader2 className="ml-auto size-3 animate-spin text-muted-foreground" />}
      </label>

      <div className={trackAll ? 'pointer-events-none opacity-50' : ''}>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tracked domains
        </div>

        <div className="flex gap-2">
          <Input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddDomain();
              }
            }}
            placeholder="example.com"
            disabled={saving || trackAll}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddDomain}
            disabled={saving || trackAll || !domainInput.trim()}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={handleImportBookmarks}
          disabled={importing || saving || trackAll}
        >
          {importing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BookmarkPlus className="size-4" />
          )}
          Import from bookmarks
        </Button>

        {sortedURLs.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            No domains yet
          </div>
        ) : (
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto pr-1">
            {sortedURLs.map((host) => (
              <li
                key={host}
                className="flex items-center justify-between rounded-md border px-2 py-1 text-xs"
              >
                <span className="truncate" title={host}>
                  {host}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(host)}
                  disabled={saving || trackAll}
                  className="ml-2 inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label={`Remove ${host}`}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {info && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
          {info}
        </div>
      )}
    </div>
  );
}
