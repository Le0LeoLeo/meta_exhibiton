import { Link } from 'react-router';
import { useI18n } from './I18nProvider';
import { Button } from './ui/button';

/** Statuses that mean the shared link itself is invalid, so retrying cannot help. */
export function isMissingLinkStatus(status: number | undefined) {
  return status === 400 || status === 403 || status === 404 || status === 410;
}

type PublicLinkUnavailableProps = {
  status?: number;
  title?: string;
  onRetry?: () => void;
};

export function PublicLinkUnavailable({ status, title, onRetry }: PublicLinkUnavailableProps) {
  const { t } = useI18n();
  const missing = isMissingLinkStatus(status) || !onRetry;
  return (
    <section role="alert" aria-labelledby="public-link-unavailable" className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-card-foreground">
      <h1 id="public-link-unavailable" className="text-2xl font-semibold">{title ?? t('publicLinkUnavailableTitle')}</h1>
      <p className="mt-3 text-muted-foreground">{t(missing ? 'publicLinkUnavailableHelp' : 'publicLinkLoadFailed')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {missing
          ? <Button asChild><Link to="/exhibitions">{t('publicLinkBrowse')}</Link></Button>
          : <Button type="button" onClick={onRetry}>{t('publicLinkRetry')}</Button>}
        <Button asChild variant="outline"><Link to="/">{t('publicLinkHome')}</Link></Button>
      </div>
    </section>
  );
}
