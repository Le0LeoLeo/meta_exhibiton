import { useStore } from '../../store/useStore';
import { useI18n } from '@/app/components/I18nProvider';
import { dismissCompanionInvitation } from '../../agent/companion';

/** A non-modal, silent invitation. It never steals focus or opens chat by itself. */
export function CompanionNotice() {
  const { t } = useI18n();
  const agent = useStore((state) => state.agent);
  const items = useStore((state) => state.items);
  const setAgent = useStore((state) => state.setAgent);
  const exhibit = items.find((item) => item.id === agent.companion.invitation?.exhibitId);
  if (!exhibit || !agent.companion.invitation || !agent.companion.proactiveEnabled || agent.isChatOpen) return null;
  return (
    <aside aria-label={t('companion.invitationTitle')} className="pointer-events-auto absolute bottom-24 right-3 z-40 max-w-[min(22rem,calc(100%-1.5rem))] rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-4 text-sm text-white shadow-lg">
      <p>{t(agent.companion.invitation.kind === 'revisit' ? 'companion.revisit' : 'companion.notice', { title: exhibit.title || t('acp.unnamedExhibit') })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setAgent({ isChatOpen: true })}
          className="min-h-11 rounded-xl bg-cyan-300 px-3 font-medium text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{t('companion.open')}</button>
        <button type="button" onClick={() => setAgent({ companion: dismissCompanionInvitation(agent.companion) })}
          className="min-h-11 rounded-xl border border-white/30 px-3 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">{t('companion.dismiss')}</button>
      </div>
    </aside>
  );
}
