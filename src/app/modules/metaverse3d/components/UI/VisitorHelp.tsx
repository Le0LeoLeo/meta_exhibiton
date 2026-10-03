import { useId, useRef, useState } from 'react';
import { useI18n } from '@/app/components/I18nProvider';

const preferenceKey = (touch: boolean) => `metaexb:visitor-help:v1:${touch ? 'touch' : 'desktop'}`;
export function completeVisitorHelp(touch: boolean) {
  try { window.localStorage.setItem(preferenceKey(touch), 'done'); } catch { /* Optional presentation preference. */ }
}
function needsVisitorHelp(touch: boolean) {
  try { return window.localStorage.getItem(preferenceKey(touch)) !== 'done'; } catch { return true; }
}

export function VisitorHelp({ touch, firstVisit = false }: { touch: boolean; firstVisit?: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(() => firstVisit && needsVisitorHelp(touch));
  return <section className="pointer-events-auto rounded-xl border border-border bg-card/95 text-left text-foreground" aria-label={t('visitorHelpTitle')}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onClick={() => { if (document.pointerLockElement) document.exitPointerLock(); if (open) completeVisitorHelp(touch); setOpen(!open); }}>
      {t('visitorHelpTitle')}<span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div id={id} className={firstVisit ? 'px-4 pb-3' : 'max-h-[40dvh] overflow-y-auto overscroll-contain px-4 pb-3'}>
      <ol className="space-y-3 text-sm leading-6">
        {[
          ['visitorHelpMove', touch ? 'visitorHelpTouchMove' : 'visitorHelpDesktopMove'],
          ['visitorHelpArtwork', touch ? 'visitorHelpTouchArtwork' : 'visitorHelpDesktopArtwork'],
          ['visitorHelpGuide', 'visitorHelpGuideCopy'],
        ].map(([title, copy], index) => <li key={title}><strong>{index + 1}. {t(title)}</strong><p className="text-muted-foreground">{t(copy)}</p></li>)}
      </ol>
      <button type="button" onClick={() => { completeVisitorHelp(touch); setOpen(false); trigger.current?.focus(); }} className="mt-3 min-h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{t('visitorHelpDone')}</button>
    </div>}
  </section>;
}
