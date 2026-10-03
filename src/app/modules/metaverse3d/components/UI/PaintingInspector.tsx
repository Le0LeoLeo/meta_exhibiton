import { Loader2, Square as StopIcon, Volume2 } from "lucide-react";
import { useState } from "react";
import { ExhibitItem, PaintingFrameAppearance } from "../../types";
import {
  getPaintingFrameAppearance,
  PAINTING_FRAME_PRESETS,
} from "../../paintingFrameAppearance";
import { useI18n } from "../../../../components/I18nProvider";
import { requestPolishIntro, requestTranslate } from "../../../../api/aiWriting";
import { loadAuth } from "../../../../api/client";
import { TTS_ENABLED } from "../../../../api/tts";
import { toast } from "sonner";
import { ExhibitWorkContextEditor } from './ExhibitWorkContextEditor';

type Props = {
  selectedItem: ExhibitItem;
  glassInputClass: string;
  glassButtonClass: string;
  keepFrameAspectRatio: boolean;
  setKeepFrameAspectRatio: (value: boolean) => void;
  maxPaintingUploadSizeMB: number;
  selectedItemIsVideo: boolean;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
  setAllPaintingFrameSize: (width: number, height: number) => void;
  setAllPaintingFrameAppearance: (appearance: PaintingFrameAppearance) => void;
  isTtsGenerating: boolean;
  isTtsSpeaking: boolean;
  ttsError: string | null;
  playGuideAudio: () => Promise<void>;
  stopGuideAudio: () => void;
};

export function PaintingInspector({
  selectedItem,
  glassInputClass,
  glassButtonClass,
  keepFrameAspectRatio,
  setKeepFrameAspectRatio,
  maxPaintingUploadSizeMB,
  selectedItemIsVideo,
  updateItem,
  setAllPaintingFrameSize,
  setAllPaintingFrameAppearance,
  isTtsGenerating,
  isTtsSpeaking,
  ttsError,
  playGuideAudio,
  stopGuideAudio,
}: Props) {
  const { t } = useI18n();
  const [writingLoading, setWritingLoading] = useState<string | null>(null);
  const frameAppearance = getPaintingFrameAppearance(selectedItem);
  const updateFrameAppearance = (
    updates: Partial<PaintingFrameAppearance>,
  ) => updateItem(selectedItem.id, updates);
  return (
    <div className="space-y-3 text-white">
      <div>
        <label className="mb-1 block text-xs font-medium text-white/75">{t('editorFileLink')}</label>
        <input
          type="text"
          value={selectedItem.content}
          onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
          className={`w-full rounded-xl px-3 py-2 text-sm ${glassInputClass}`}
          placeholder={t('painting.filePlaceholder')}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-white/75">{t('painting.upload')}</label>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx,.mp4,.webm,.ogg,application/pdf,image/png,image/jpeg,video/mp4,video/webm,video/ogg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className={`w-full rounded-xl px-3 py-2 text-sm ${glassInputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-600`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const maxBytes = maxPaintingUploadSizeMB * 1024 * 1024;
            if (file.size > maxBytes) {
              window.alert(t('painting.tooLarge', { size: maxPaintingUploadSizeMB }));
              e.currentTarget.value = "";
              return;
            }

            const lowerName = file.name.toLowerCase();
            const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(lowerName);
            const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|ogg)$/i.test(lowerName);
            const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
            const isDocx =
              file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
              lowerName.endsWith(".docx");

            if (!(isImage || isVideo || isPdf || isDocx)) {
              window.alert(t('painting.unsupported'));
              e.currentTarget.value = "";
              return;
            }

            const finishUpdate = (contentUrl: string) => {
              const baseUpdates: Partial<ExhibitItem> = {
                content: contentUrl,
                fileName: file.name,
                fileMimeType: file.type || "application/octet-stream",
              };

              if (isVideo) {
                const objectUrl = URL.createObjectURL(file);
                const video = document.createElement("video");
                video.preload = "metadata";
                video.src = objectUrl;
                video.muted = true;

                const applyVideoUpdates = (videoThumbnailUrl: string) => {
                  updateItem(selectedItem.id, {
                    ...baseUpdates,
                    videoThumbnailUrl,
                    videoMuted: selectedItem.videoMuted ?? true,
                    videoAutoplay: selectedItem.videoAutoplay ?? false,
                    videoLoop: selectedItem.videoLoop ?? false,
                  });
                };

                const generateThumbnail = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = 640;
                  canvas.height = 360;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) {
                    applyVideoUpdates(objectUrl);
                    return;
                  }

                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  applyVideoUpdates(canvas.toDataURL("image/jpeg", 0.8));
                };

                video.addEventListener(
                  "loadeddata",
                  () => {
                    const seekTime = Number.isFinite(video.duration)
                      ? Math.min(0.25, Math.max(0, video.duration * 0.05))
                      : 0;

                    const drawWithFallback = () => {
                      try {
                        generateThumbnail();
                      } catch {
                        applyVideoUpdates(objectUrl);
                      }
                    };

                    if (seekTime > 0) {
                      video.currentTime = seekTime;
                      video.addEventListener("seeked", drawWithFallback, { once: true });
                    } else {
                      drawWithFallback();
                    }
                  },
                  { once: true },
                );

                video.addEventListener(
                  "error",
                  () => {
                    applyVideoUpdates(objectUrl);
                  },
                  { once: true },
                );
              } else {
                updateItem(selectedItem.id, {
                  ...baseUpdates,
                  videoThumbnailUrl: undefined,
                  videoMuted: undefined,
                  videoAutoplay: undefined,
                  videoLoop: undefined,
                });
              }
            };

            if (isImage) {
              const reader = new FileReader();
              reader.onload = () => finishUpdate(String(reader.result || ""));
              reader.onerror = () => {
                window.alert(t('painting.readFailed'));
              };
              reader.readAsDataURL(file);
            } else {
              finishUpdate(URL.createObjectURL(file));
            }

            e.currentTarget.value = "";
          }}
        />
        <p className="mt-1 text-xs text-white/65">{t('painting.uploadHelp', { size: maxPaintingUploadSizeMB })}</p>
        {selectedItem.fileName && <p className="mt-1 text-xs text-white/65">{t('painting.currentFile')}{selectedItem.fileName}</p>}
      </div>

      {selectedItemIsVideo && (
        <div className="space-y-3 rounded-2xl border border-indigo-200/60 bg-indigo-300/12 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md">
          <p className="text-xs font-semibold text-white">{t('painting.videoSettings')}</p>
          <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={Boolean(selectedItem.videoAutoplay)} onChange={(e) => updateItem(selectedItem.id, { videoAutoplay: e.target.checked })} />{t('painting.autoplay')}</label>
          <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={Boolean(selectedItem.videoLoop)} onChange={(e) => updateItem(selectedItem.id, { videoLoop: e.target.checked })} />{t('painting.loop')}</label>
          <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={selectedItem.videoMuted ?? true} onChange={(e) => updateItem(selectedItem.id, { videoMuted: e.target.checked })} />{t('painting.muted')}</label>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/75">{t('painting.coverUpload')}</label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);
                if (!isImage) {
                  window.alert(t('painting.coverUnsupported'));
                  e.currentTarget.value = "";
                  return;
                }
                updateItem(selectedItem.id, { videoThumbnailUrl: URL.createObjectURL(file) });
                e.currentTarget.value = "";
              }}
            />
          </div>
          {selectedItem.videoThumbnailUrl && (
            <div>
              <p className="mb-1 text-xs text-white/65">{t('painting.coverPreview')}</p>
              <img src={selectedItem.videoThumbnailUrl} alt={t('painting.coverAlt')} className="max-h-40 w-full rounded border border-white/25 bg-white object-contain" />
            </div>
          )}
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-white/15 bg-white/8 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div>
          <p className="text-sm font-semibold text-white">{t('painting.appearance')}</p>
          <p className="mt-0.5 text-[11px] text-white/60">
            {t('painting.appearanceHelp')}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PAINTING_FRAME_PRESETS.map((preset) => {
            const isActive = frameAppearance.frameStyle === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => updateItem(selectedItem.id, preset.appearance)}
                className={`rounded-xl border p-2 text-left transition ${
                  isActive
                    ? "border-indigo-300 bg-indigo-400/25 ring-1 ring-indigo-200/70"
                    : "border-white/15 bg-black/10 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-5 shrink-0 rounded-md border border-white/25 shadow-inner"
                    style={{ backgroundColor: preset.appearance.frameColor }}
                  />
                  <span className="text-xs font-semibold text-white">{t(`painting.preset.${preset.id}`)}</span>
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-white/55">
                  {t(`painting.preset.${preset.id}Help`)}
                </span>
              </button>
            );
          })}
        </div>

        {frameAppearance.frameStyle !== "borderless" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-white/70">
                {t('painting.outerColor')}<span className="mt-1 flex items-center gap-2 rounded-xl border border-white/15 bg-black/10 p-1.5">
                  <input
                    aria-label={t('painting.outerColor')}
                    type="color"
                    value={frameAppearance.frameColor}
                    onChange={(event) => updateFrameAppearance({ frameColor: event.target.value })}
                    className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="truncate font-mono text-[10px] text-white/70">
                    {frameAppearance.frameColor}
                  </span>
                </span>
              </label>
              <label className="text-[11px] text-white/70">
                {t('painting.innerColor')}<span className="mt-1 flex items-center gap-2 rounded-xl border border-white/15 bg-black/10 p-1.5">
                  <input
                    aria-label={t('painting.innerColor')}
                    type="color"
                    value={frameAppearance.frameInnerColor}
                    onChange={(event) => updateFrameAppearance({ frameInnerColor: event.target.value })}
                    className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="truncate font-mono text-[10px] text-white/70">
                    {frameAppearance.frameInnerColor}
                  </span>
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-white/70">
                {t('painting.thickness')}<input
                  aria-label={t('painting.width')}
                  type="range"
                  min="0.02"
                  max="0.3"
                  step="0.005"
                  value={frameAppearance.frameThickness}
                  onChange={(event) => updateFrameAppearance({ frameThickness: Number(event.target.value) })}
                  className="mt-2 w-full accent-indigo-400"
                />
                <span className="block text-right text-[10px] text-white/50">
                  {frameAppearance.frameThickness.toFixed(3)} m
                </span>
              </label>
              <label className="text-[11px] text-white/70">
                {t('painting.depthShort')}<input
                  aria-label={t('painting.depth')}
                  type="range"
                  min="0.02"
                  max="0.2"
                  step="0.005"
                  value={frameAppearance.frameDepth}
                  onChange={(event) => updateFrameAppearance({ frameDepth: Number(event.target.value) })}
                  className="mt-2 w-full accent-indigo-400"
                />
                <span className="block text-right text-[10px] text-white/50">
                  {frameAppearance.frameDepth.toFixed(3)} m
                </span>
              </label>
            </div>
          </>
        )}

        <div className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-2.5">
          <label className="flex items-center justify-between gap-3 text-xs text-white/80">
            <span>
              <span className="block font-medium text-white">{t('painting.mat')}</span>
              <span className="text-[10px] text-white/50">{t('painting.matHelp')}</span>
            </span>
            <input
              type="checkbox"
              checked={frameAppearance.frameMatEnabled}
              disabled={frameAppearance.frameStyle === "floating" || frameAppearance.frameStyle === "borderless"}
              onChange={(event) => updateFrameAppearance({ frameMatEnabled: event.target.checked })}
              className="size-4 accent-indigo-500"
            />
          </label>
          {frameAppearance.frameMatEnabled && frameAppearance.frameStyle !== "floating" && (
            <div className="grid grid-cols-[auto_1fr] items-end gap-3">
              <label className="text-[10px] text-white/60">
                {t('painting.matColorShort')}<input
                  aria-label={t('painting.matColor')}
                  type="color"
                  value={frameAppearance.frameMatColor}
                  onChange={(event) => updateFrameAppearance({ frameMatColor: event.target.value })}
                  className="mt-1 block h-8 w-11 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </label>
              <label className="text-[10px] text-white/60">
                {t('painting.matWidth')}<input
                  aria-label={t('painting.matWidth')}
                  type="range"
                  min="0.02"
                  max="0.35"
                  step="0.01"
                  value={frameAppearance.frameMatWidth}
                  onChange={(event) => updateFrameAppearance({ frameMatWidth: Number(event.target.value) })}
                  className="mt-2 w-full accent-indigo-400"
                />
              </label>
            </div>
          )}
          <label className="flex items-center justify-between gap-3 border-t border-white/10 pt-2 text-xs text-white/80">
            <span>
              <span className="block font-medium text-white">{t('painting.glass')}</span>
              <span className="text-[10px] text-white/50">{t('painting.glassHelp')}</span>
            </span>
            <input
              type="checkbox"
              checked={frameAppearance.frameGlassEnabled}
              onChange={(event) => updateFrameAppearance({ frameGlassEnabled: event.target.checked })}
              className="size-4 accent-indigo-500"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => setAllPaintingFrameAppearance(frameAppearance)}
          className={`w-full rounded-xl px-3 py-2 text-xs font-semibold text-white ${glassButtonClass}`}
        >
          {t('painting.applyAppearance')}</button>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">{t('painting.width')}</label>
          <input
            type="number"
            min="0.8"
            max="6"
            step="0.1"
            value={selectedItem.frameWidth ?? 2}
            onChange={(e) => {
              const width = Math.max(0.8, Math.min(6, Number(e.target.value) || 2));
              if (!keepFrameAspectRatio) {
                updateItem(selectedItem.id, { frameWidth: width });
                return;
              }
              const currentWidth = selectedItem.frameWidth ?? 2;
              const currentHeight = selectedItem.frameHeight ?? 1.5;
              const ratio = currentHeight / Math.max(0.01, currentWidth);
              const nextHeight = Math.max(0.6, Math.min(4, width * ratio));
              updateItem(selectedItem.id, { frameWidth: width, frameHeight: nextHeight });
            }}
            className={`w-full rounded-xl px-2 py-1.5 text-sm ${glassInputClass}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">{t('painting.height')}</label>
          <input
            type="number"
            min="0.6"
            max="4"
            step="0.1"
            value={selectedItem.frameHeight ?? 1.5}
            onChange={(e) => {
              const height = Math.max(0.6, Math.min(4, Number(e.target.value) || 1.5));
              if (!keepFrameAspectRatio) {
                updateItem(selectedItem.id, { frameHeight: height });
                return;
              }
              const currentWidth = selectedItem.frameWidth ?? 2;
              const currentHeight = selectedItem.frameHeight ?? 1.5;
              const ratio = currentWidth / Math.max(0.01, currentHeight);
              const nextWidth = Math.max(0.8, Math.min(6, height * ratio));
              updateItem(selectedItem.id, { frameHeight: height, frameWidth: nextWidth });
            }}
            className="w-full rounded-md border border-white/25 bg-white/10 px-2 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={keepFrameAspectRatio} onChange={(e) => setKeepFrameAspectRatio(e.target.checked)} />{t('painting.keepRatio')}</label>
      <button onClick={() => setAllPaintingFrameSize(selectedItem.frameWidth ?? 2, selectedItem.frameHeight ?? 1.5)} className="w-full rounded-xl border border-indigo-200/70 bg-indigo-500/20 px-2 py-1.5 text-xs font-medium text-white shadow-[0_6px_18px_rgba(79,70,229,0.12)] backdrop-blur-md transition-colors hover:bg-indigo-500/28">{t('painting.applySize')}</button>
      <div><label className="mb-1 block text-xs font-medium text-white/75">{t('painting.title')}</label><input aria-label={t("painting.title")} type="text" value={selectedItem.title || ""} onChange={(e) => updateItem(selectedItem.id, { title: e.target.value })} className="w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/55" placeholder={t('painting.titlePlaceholder')} /></div>
      <div><label className="mb-1 block text-xs font-medium text-white/75">{t('painting.artist')}</label><input aria-label={t("painting.artist")} type="text" value={selectedItem.artist || ""} onChange={(e) => updateItem(selectedItem.id, { artist: e.target.value })} className="w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/55" placeholder={t('painting.artistPlaceholder')} /></div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-white/75">{t('painting.description')}</label>
          <div className="flex gap-1">
            <button
              onClick={async () => {
                const desc = selectedItem.description;
                if (!desc || !desc.trim()) return;
                setWritingLoading("polish");
                try {
                  const { token } = loadAuth();
                  if (!token) throw new Error(t("acp.loginRequired"));
                  const { result } = await requestPolishIntro(token, { text: desc });
                  updateItem(selectedItem.id, { description: result });
                  toast.success(t('painting.polishSuccess'));
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : t('painting.polishFailed'));
                } finally {
                  setWritingLoading(null);
                }
              }}
              disabled={!!writingLoading}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] disabled:opacity-50 ${glassButtonClass}`}
            >
              {writingLoading === "polish" ? <Loader2 className="size-3 animate-spin" /> : null}{t('painting.polish')}</button>
            <button
              onClick={async () => {
                const desc = selectedItem.description;
                if (!desc || !desc.trim()) return;
                setWritingLoading("en");
                try {
                  const { token } = loadAuth();
                  if (!token) throw new Error(t("acp.loginRequired"));
                  const { result } = await requestTranslate(token, { text: desc, targetLanguage: "English" });
                  toast.success(t('painting.englishResult', { result }));
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : t('painting.translationFailed'));
                } finally {
                  setWritingLoading(null);
                }
              }}
              disabled={!!writingLoading}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] disabled:opacity-50 ${glassButtonClass}`}
            >
              {writingLoading === "en" ? <Loader2 className="size-3 animate-spin" /> : null}EN
            </button>
            <button
              onClick={async () => {
                const desc = selectedItem.description;
                if (!desc || !desc.trim()) return;
                setWritingLoading("pt");
                try {
                  const { token } = loadAuth();
                  if (!token) throw new Error(t("acp.loginRequired"));
                  const { result } = await requestTranslate(token, { text: desc, targetLanguage: "Portuguese" });
                  toast.success(t('painting.portugueseResult', { result }));
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : t('painting.translationFailed'));
                } finally {
                  setWritingLoading(null);
                }
              }}
              disabled={!!writingLoading}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] disabled:opacity-50 ${glassButtonClass}`}
            >
              {writingLoading === "pt" ? <Loader2 className="size-3 animate-spin" /> : null}PT
            </button>
          </div>
        </div>
        <textarea aria-label={t("painting.description")} value={selectedItem.description || ""} onChange={(e) => updateItem(selectedItem.id, { description: e.target.value })} className={`h-24 w-full rounded-xl px-3 py-2 text-sm ${glassInputClass}`} placeholder={t('painting.descriptionPlaceholder')} />
      </div>
      <ExhibitWorkContextEditor item={selectedItem} updateItem={updateItem} />
      {TTS_ENABLED && <div className="rounded-2xl border border-violet-200/60 bg-violet-300/12 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md">
        <p className="mb-2 text-xs font-semibold text-white">{t('painting.voice')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void playGuideAudio()} disabled={isTtsGenerating} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70">{isTtsGenerating ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}{isTtsGenerating ? t('painting.generating') : t('painting.play')}</button>
          {isTtsSpeaking && <button onClick={stopGuideAudio} className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-white transition-colors ${glassButtonClass}`}><StopIcon className="size-4" />{t('painting.stop')}</button>}
        </div>
        {ttsError && <p className="mt-2 text-xs text-rose-300">{ttsError}</p>}
      </div>}
      <div><label className="mb-1 block text-xs font-medium text-white/75">{t('painting.externalLink')}</label><input aria-label={t("painting.externalLink")} type="text" value={selectedItem.externalUrl || ""} onChange={(e) => updateItem(selectedItem.id, { externalUrl: e.target.value })} className="w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/55" placeholder="https://..." /></div>
    </div>
  );
}
