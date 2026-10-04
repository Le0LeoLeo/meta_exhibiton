import { useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, ImageIcon, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useI18n } from '@/app/components/I18nProvider';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { QUICK_EXHIBITION_MAX_ARTWORK_TEXT_LENGTH, QUICK_EXHIBITION_MAX_ASSETS, QUICK_EXHIBITION_MAX_DESCRIPTION_LENGTH, QUICK_EXHIBITION_MAX_FILE_BYTES } from './quickExhibitionState';
import type { QuickUploadItem } from './types';

export type QuickUploadPanelProps = {
  items: QuickUploadItem[];
  title: string;
  onTitleChange: (title: string) => void;
  onArtworkTitleChange: (id: string, title: string) => void;
  onArtistChange: (id: string, artist: string) => void;
  onDescriptionChange: (id: string, description: string) => void;
  onSelectFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  disabled?: boolean;
  maxAssets?: number;
  maxFileBytes?: number;
};

const statusLabels = {
  pending: 'quickExhibitionStatusPending',
  uploading: 'quickExhibitionStatusUploading',
  succeeded: 'quickExhibitionStatusSucceeded',
  failed: 'quickExhibitionStatusFailed',
  missing: 'quickExhibitionStatusMissing',
} satisfies Record<QuickUploadItem['status'], string>;

const errorLabels: Record<string, string> = {
  RATE_LIMITED: 'quickExhibitionRateLimited',
  AUTH_REQUIRED: 'quickExhibitionAuthRequired',
  DRAFT_CHANGED: 'quickExhibitionConflict',
  SCENE_CHANGED: 'quickExhibitionConflict',
  FILE_RESELECT_REQUIRED: 'quickExhibitionResumeFiles',
  TOO_MANY_ASSETS: 'quickExhibitionTooMany',
  FILE_TOO_LARGE: 'quickExhibitionTooLarge',
  UNSUPPORTED_FILE: 'quickExhibitionUnsupported',
  INVALID_UPLOAD: 'quickExhibitionUnsupported',
};

function UploadThumbnail({ item }: { item: QuickUploadItem }) {
  const { t } = useI18n();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = item.previewUrl || item.asset?.previewUrl || item.asset?.url;

  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary sm:size-16">
      {url && url !== failedUrl ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-contain"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <>
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          {url ? <span className="sr-only">{t('quickExhibitionImageFailed')}</span> : null}
        </>
      )}
    </div>
  );
}

export function QuickUploadPanel({
  items,
  title,
  onTitleChange,
  onArtworkTitleChange,
  onArtistChange,
  onDescriptionChange,
  onSelectFiles,
  onRemove,
  onRetry,
  disabled = false,
  maxAssets = QUICK_EXHIBITION_MAX_ASSETS,
  maxFileBytes = QUICK_EXHIBITION_MAX_FILE_BYTES,
}: QuickUploadPanelProps) {
  const { t, locale } = useI18n();
  const id = useId();
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileLimit = (maxFileBytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 2 });

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5 rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <label
        htmlFor={`${id}-files`}
        className={`block rounded-md border-2 border-dashed p-6 text-center transition-colors focus-within:border-curator-brass focus-within:ring-2 focus-within:ring-curator-brass/30 sm:p-10 ${disabled ? 'cursor-not-allowed border-border opacity-60' : isDragging ? 'cursor-copy border-curator-brass bg-secondary' : 'cursor-pointer border-border bg-secondary/30 hover:border-curator-brass/70'}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (disabled) return;
          dragDepth.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setIsDragging(false);
          const files = Array.from(event.dataTransfer.files);
          if (!disabled && files.length > 0) onSelectFiles(files);
        }}
      >
        <Upload className="mx-auto mb-3 size-8 text-curator-brass" aria-hidden="true" />
        <span id={`${id}-action`} className="block text-base font-semibold">
          {t('quickExhibitionUploadAction')}
        </span>
        <span id={`${id}-hint`} className="mt-2 block text-sm leading-6 text-muted-foreground">
          {t('quickExhibitionUploadHint', { max: maxAssets })}
          <span className="block">{t('quickExhibitionFileLimit', { max: fileLimit })}</span>
        </span>
        <input
          id={`${id}-files`}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          disabled={disabled}
          aria-labelledby={`${id}-action`}
          aria-describedby={`${id}-hint`}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            if (!disabled && files.length > 0) onSelectFiles(files);
          }}
        />
      </label>

      {items.some((item) => item.status === 'missing') ? (
        <p role="status" className="rounded-md border border-border bg-secondary p-3 text-sm leading-6">
          {t('quickExhibitionResumeFiles')}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => {
            const needsAttention = item.status === 'failed' || item.status === 'missing';
            const StatusIcon = item.status === 'uploading' ? Loader2
              : item.status === 'succeeded' ? CheckCircle2
                : needsAttention ? AlertCircle : Clock3;

            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 sm:p-4">
                <UploadThumbnail item={item} />
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-medium">{item.fileName}</p>
                  <div aria-live="polite" aria-atomic="true" className="mt-1 space-y-1 text-sm">
                    <p className={`flex items-center gap-1.5 ${needsAttention ? 'text-destructive' : 'text-muted-foreground'}`}>
                      <StatusIcon className={`size-4 shrink-0 ${item.status === 'uploading' ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
                      {t(statusLabels[item.status])}
                    </p>
                    {item.status === 'failed' ? (
                      <p className="break-words text-destructive">
                        {t(errorLabels[item.error ?? ''] ?? 'quickExhibitionError', {
                          max: item.error === 'TOO_MANY_ASSETS' ? maxAssets : fileLimit,
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex w-full justify-end gap-2 sm:w-auto">
                  {item.status === 'failed' ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={disabled}
                      aria-label={`${t('quickExhibitionRetry')}: ${item.fileName}`}
                      onClick={() => onRetry(item.id)}
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      {t('quickExhibitionRetry')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    disabled={disabled || item.status === 'uploading'}
                    aria-label={`${t('quickExhibitionRemove')}: ${item.fileName}`}
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                {item.status === 'succeeded' && item.asset && (
                  <details className="w-full space-y-2 border-t border-border pt-1">
                    <summary className="min-h-11 cursor-pointer rounded-md py-3 text-sm font-medium marker:text-muted-foreground">
                      <span className="break-words">{item.asset.title || item.fileName}</span>
                      <span className="ml-2 text-muted-foreground">{t('quickExhibitionArtworkDetails')}</span>
                    </summary>
                    <div className="mb-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor={`${id}-${item.id}-artwork-title`} className="text-sm font-medium">
                          {t('quickExhibitionArtworkTitleLabel')}
                        </label>
                        <Input
                          id={`${id}-${item.id}-artwork-title`}
                          value={item.asset.title}
                          onChange={(event) => onArtworkTitleChange(item.id, event.currentTarget.value)}
                          placeholder={t('quickExhibitionArtworkTitlePlaceholder')}
                          maxLength={QUICK_EXHIBITION_MAX_ARTWORK_TEXT_LENGTH}
                          disabled={disabled}
                          className="min-h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor={`${id}-${item.id}-artist`} className="text-sm font-medium">
                          {t('quickExhibitionArtistLabel')}
                        </label>
                        <Input
                          id={`${id}-${item.id}-artist`}
                          value={item.asset.artist}
                          onChange={(event) => onArtistChange(item.id, event.currentTarget.value)}
                          placeholder={t('quickExhibitionArtistPlaceholder')}
                          maxLength={QUICK_EXHIBITION_MAX_ARTWORK_TEXT_LENGTH}
                          disabled={disabled}
                          className="min-h-11"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor={`${id}-${item.id}-description`} className="text-sm font-medium">
                        {t('quickExhibitionDescriptionLabel')}
                      </label>
                      <span id={`${id}-${item.id}-description-count`} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {item.asset.description.length} / {QUICK_EXHIBITION_MAX_DESCRIPTION_LENGTH}
                      </span>
                    </div>
                    <Textarea
                      id={`${id}-${item.id}-description`}
                      value={item.asset.description}
                      onChange={(event) => onDescriptionChange(item.id, event.currentTarget.value)}
                      placeholder={t('quickExhibitionDescriptionPlaceholder')}
                      aria-describedby={`${id}-${item.id}-description-count`}
                      maxLength={QUICK_EXHIBITION_MAX_DESCRIPTION_LENGTH}
                      disabled={disabled}
                      rows={3}
                      className="field-sizing-fixed min-h-24 resize-y"
                    />
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="space-y-2 border-t border-border pt-5">
        <label htmlFor={`${id}-title`} className="text-sm font-medium">
          {t('quickExhibitionTitleLabel')}
        </label>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(event) => onTitleChange(event.currentTarget.value)}
          placeholder={t('quickExhibitionDefaultTitle')}
            maxLength={120}
          disabled={disabled}
          className="min-h-11"
        />
      </div>
    </section>
  );
}
