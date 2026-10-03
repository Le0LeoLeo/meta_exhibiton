import { AlertCircle, CheckCircle2, ImageIcon, Loader2 } from 'lucide-react';
import { useI18n } from '@/app/components/I18nProvider';
import type { QuickExhibitionPhase } from './types';

export type QuickBuildProgressProps = {
  phase: QuickExhibitionPhase;
  uploadedCount: number;
  totalCount: number;
};

const phaseLabels = {
  loading: 'quickExhibitionLoading',
  empty: 'quickExhibitionEmpty',
  uploading: 'quickExhibitionStatusUploading',
  building: 'quickExhibitionBuilding',
  preview: 'quickExhibitionPreviewTitle',
  publishing: 'quickExhibitionPublishing',
  published: 'quickExhibitionPublished',
  needs_attention: 'quickExhibitionNeedsAttention',
} satisfies Record<QuickExhibitionPhase, string>;

export function QuickBuildProgress({ phase, uploadedCount, totalCount }: QuickBuildProgressProps) {
  const { t } = useI18n();
  const isBusy = phase === 'loading' || phase === 'uploading' || phase === 'building' || phase === 'publishing';
  const StatusIcon = isBusy ? Loader2 : phase === 'needs_attention' ? AlertCircle
    : phase === 'empty' ? ImageIcon : CheckCircle2;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mx-auto flex w-full max-w-4xl items-start gap-3 rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <StatusIcon
        className={`mt-0.5 size-5 shrink-0 ${isBusy ? 'motion-safe:animate-spin' : ''} ${phase === 'needs_attention' ? 'text-destructive' : 'text-curator-brass'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{t(phase === 'empty' && totalCount > 0 ? 'journeyUploaded' : phaseLabels[phase])}</p>
        {totalCount > 0 ? (
          <p className="text-sm tabular-nums text-muted-foreground">
            {t('quickExhibitionUploadCount', { count: uploadedCount, total: totalCount })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
