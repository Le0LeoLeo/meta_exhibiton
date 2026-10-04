import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { GraduationCap } from 'lucide-react';
import { graduationRequest } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { useGraduationCopy } from './copy';
import { useI18n } from '@/app/components/I18nProvider';
import { graduationErrorMessage, useGraduationError } from './errors';

export const inputClass = 'w-full min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const panelClass = 'rounded-md border border-border bg-card p-5 sm:p-7 space-y-4';

export function useGraduationResource<T>(path: string) {
  const { locale } = useI18n();
  const [value, setValue] = useState<T | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const reload = useCallback(() => setGeneration((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setErrorStatus(undefined);
    graduationRequest<T>(path).then((data) => { if (active) { setValue(data); setLoadedPath(path); } })
      .catch((reason: unknown) => { if (active) { setError(graduationErrorMessage(reason, locale)); setErrorStatus((reason as { status?: number } | null)?.status); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, generation, locale]);
  return { value: loadedPath === path ? value : null, error, errorStatus, loading, reload };
}

export function useGraduationAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const errorMessage = useGraduationError();
  async function run(action: () => Promise<void>) {
    setPending(true); setError('');
    try { await action(); }
    catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally { setPending(false); }
  }
  return { pending, error, run };
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>;
}
export function ErrorNotice({ error }: { error: string }) {
  return error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">{error}</p> : null;
}
export function ResourceNotice({ loading, error, errorStatus, reload }: { loading: boolean; error: string; errorStatus?: number; reload: () => void }) {
  const c = useGraduationCopy();
  const missing = errorStatus === 403 || errorStatus === 404 || errorStatus === 410;
  return <>{loading && <p role="status" className="py-4 text-muted-foreground">{c.loading}</p>}<ErrorNotice error={error} />
    {error && (missing ? <Button asChild variant="outline"><Link to="/graduation">{c.workspace}</Link></Button> : <Button variant="outline" onClick={reload}>{c.retry}</Button>)}</>;
}
export function GraduationShell({ title, description, children, showWorkspaceNav = true }: { title: string; description?: string; children: ReactNode; showWorkspaceNav?: boolean }) {
  const c = useGraduationCopy();
  return <div className="mx-auto max-w-6xl space-y-7 px-4 py-10 sm:px-6 sm:py-14">
    <header className="museum-workspace-heading space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary"><GraduationCap className="size-5" aria-hidden="true" />Paidea · {c.workflow}</div>
      <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {description && <p className="max-w-3xl whitespace-pre-wrap break-words text-muted-foreground">{description}</p>}
      {showWorkspaceNav && <nav aria-label={c.title} className="flex flex-wrap gap-4 text-sm underline underline-offset-4">
        <Link to="/graduation">{c.workspace}</Link><Link to="/graduation/portfolio">{c.portfolio}</Link>
      </nav>}
    </header>{children}
  </div>;
}
