import { useEffect, useState } from 'react';
import { useI18n } from '../../../../components/I18nProvider';
import type { ExhibitItem, ExhibitWorkContext } from '../../types';

type WorkContextSource = NonNullable<ExhibitWorkContext['sources']>[number];
const textFields = ['contribution', 'process', 'outcome', 'reflection'] as const;

function isHttpUrl(value: string) {
  if (!value) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function ExhibitWorkContextEditor({
  item,
  updateItem,
}: {
  item: ExhibitItem;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
}) {
  const { t } = useI18n();
  const workContext = item.workContext ?? {};
  const committedSources = workContext.sources ?? [];
  const [sourceDrafts, setSourceDrafts] = useState<WorkContextSource[]>(committedSources);
  const [sourceError, setSourceError] = useState(false);
  const committedSourceSignature = JSON.stringify(committedSources);

  useEffect(() => {
    setSourceDrafts(JSON.parse(committedSourceSignature) as WorkContextSource[]);
    setSourceError(false);
  }, [item.id, committedSourceSignature]);

  const updateContext = (next: ExhibitWorkContext) => {
    updateItem(item.id, { workContext: next });
  };
  const updateSourceDraft = (index: number, updates: Partial<WorkContextSource>) => {
    setSourceDrafts((current) => current.map((source, sourceIndex) => sourceIndex === index ? { ...source, ...updates } : source));
    setSourceError(false);
  };
  const saveSources = () => {
    const normalized = sourceDrafts.map((source) => ({
      label: source.label.trim(),
      ...(source.url?.trim() ? { url: source.url.trim() } : {}),
      ...(source.excerpt?.trim() ? { excerpt: source.excerpt.trim() } : {}),
    }));
    if (normalized.some((source) => !source.label || !isHttpUrl(source.url ?? ''))) {
      setSourceError(true);
      return;
    }
    updateContext({ ...workContext, sources: normalized });
    setSourceDrafts(normalized);
    setSourceError(false);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-white/15 bg-white/8 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div>
        <h4 className="text-sm font-semibold text-white">{t('workContextTitle')}</h4>
        <p className="mt-1 text-xs leading-5 text-white/70">{t('workContextIntro')}</p>
        <p className="mt-2 rounded-xl border border-amber-200/20 bg-amber-100/10 p-2 text-xs leading-5 text-amber-50/90">{t('workContextPrivacy')}</p>
      </div>

      {textFields.map((field) => (
        <label key={field} className="block text-xs font-medium text-white/80">
          {t(`workContext${field[0].toUpperCase()}${field.slice(1)}`)}
          <textarea
            aria-label={t(`workContext${field[0].toUpperCase()}${field.slice(1)}`)}
            maxLength={2000}
            value={workContext[field] ?? ''}
            onChange={(event) => updateContext({ ...workContext, [field]: event.target.value })}
            className="mt-1 min-h-20 w-full rounded-xl border border-white/15 bg-black/10 px-3 py-2 text-sm text-white placeholder:text-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
          />
        </label>
      ))}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-white/85">{t('workContextSources')}</p>
          <button
            type="button"
            disabled={sourceDrafts.length >= 5}
            onClick={() => setSourceDrafts((current) => [...current, { label: '' }])}
            className="min-h-9 rounded-lg border border-white/20 px-3 text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('workContextAddSource')}
          </button>
        </div>
        <p className="text-[11px] leading-4 text-white/60">{t('workContextSourceHint')}</p>
        {sourceDrafts.map((source, index) => (
          <fieldset key={index} className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-2.5">
            <legend className="sr-only">{t('workContextSourceNumber', { number: index + 1 })}</legend>
            <label className="block text-[11px] font-medium text-white/75">
              {t('workContextSourceLabel')}
              <input
                aria-label={t('workContextSourceLabelNumber', { number: index + 1 })}
                maxLength={200}
                value={source.label}
                onChange={(event) => updateSourceDraft(index, { label: event.target.value })}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-2.5 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-[11px] font-medium text-white/75">
              {t('workContextSourceUrl')}
              <input
                aria-label={t('workContextSourceUrlNumber', { number: index + 1 })}
                type="url"
                maxLength={1000}
                value={source.url ?? ''}
                onChange={(event) => updateSourceDraft(index, { url: event.target.value })}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-2.5 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-[11px] font-medium text-white/75">
              {t('workContextSourceExcerpt')}
              <textarea
                aria-label={t('workContextSourceExcerptNumber', { number: index + 1 })}
                maxLength={2000}
                value={source.excerpt ?? ''}
                onChange={(event) => updateSourceDraft(index, { excerpt: event.target.value })}
                className="mt-1 min-h-16 w-full rounded-lg border border-white/15 bg-black/20 px-2.5 py-2 text-sm text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => setSourceDrafts((current) => current.filter((_, sourceIndex) => sourceIndex !== index))}
              className="min-h-9 rounded-lg px-2 text-xs text-rose-100 hover:bg-rose-300/10"
            >
              {t('workContextRemoveSourceNumber', { number: index + 1 })}
            </button>
          </fieldset>
        ))}
        {sourceError && <p role="alert" className="text-xs text-rose-200">{t('workContextSourceInvalid')}</p>}
        <button type="button" onClick={saveSources} className="min-h-9 rounded-lg bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15">
          {t('workContextSaveSources')}
        </button>
      </div>
    </section>
  );
}
