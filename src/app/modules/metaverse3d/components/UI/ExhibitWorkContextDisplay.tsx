import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../../../components/I18nProvider';
import type { ExhibitItem } from '../../types';
import { normalizeWorkContext } from '../../workContext';

const fields = ['contribution', 'process', 'outcome', 'reflection'] as const;

export function ExhibitWorkContextDisplay({ item, headingId = 'exhibit-work-context-title' }: { item: Pick<ExhibitItem, 'workContext'>; headingId?: string }) {
  const { t } = useI18n();
  const workContext = normalizeWorkContext(item.workContext);
  if (!workContext) return null;

  return (
    <section aria-labelledby={headingId} className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
      <div>
        <h3 id={headingId} className="text-base font-semibold text-stone-900 dark:text-white">{t('workContextTitle')}</h3>
        <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-400">{t('workContextPublic')}</p>
      </div>
      {fields.map((field) => {
        const value = workContext[field];
        return value ? (
          <div key={field}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">{t(`workContext${field[0].toUpperCase()}${field.slice(1)}`)}</h4>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-800 dark:text-stone-200">{value}</p>
          </div>
        ) : null;
      })}
      {!!workContext.sources?.length && <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">{t('workContextSources')}</h4>
        <ul className="mt-2 space-y-3">
          {workContext.sources.map((source, index) => <li key={`${source.label}-${index}`} className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-950">
            <p className="text-sm font-medium text-stone-900 dark:text-white">{source.label}</p>
            {source.excerpt && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300">{source.excerpt}</p>}
            {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300">
              {t('workContextOpenSource')}<ExternalLink aria-hidden="true" className="size-3.5" />
            </a>}
          </li>)}
        </ul>
      </div>}
    </section>
  );
}
