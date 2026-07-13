import { Loader2, Square as StopIcon, Volume2 } from "lucide-react";
import { useState } from "react";
import { ExhibitItem } from "../../types";
import { useI18n } from "../../../../components/I18nProvider";
import { requestPolishIntro, requestTranslate } from "../../../../api/aiWriting";
import { loadAuth } from "../../../../api/client";
import { toast } from "sonner";

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
  isTtsGenerating,
  isTtsSpeaking,
  ttsError,
  playGuideAudio,
  stopGuideAudio,
}: Props) {
  const { t } = useI18n();
  const [writingLoading, setWritingLoading] = useState<string | null>(null);
  return (
    <div className="space-y-3 text-white">
      <div>
        <label className="mb-1 block text-xs font-medium text-white/75">{t('editorFileLink')}</label>
        <input
          type="text"
          value={selectedItem.content}
          onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
          className={`w-full rounded-xl px-3 py-2 text-sm ${glassInputClass}`}
          placeholder="https://... 或上傳檔案後自動填入"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-white/75">上傳檔案（pdf/png/jpg/jpeg/docx/mp4/webm/ogg）</label>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx,.mp4,.webm,.ogg,application/pdf,image/png,image/jpeg,video/mp4,video/webm,video/ogg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className={`w-full rounded-xl px-3 py-2 text-sm ${glassInputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-600`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const maxBytes = maxPaintingUploadSizeMB * 1024 * 1024;
            if (file.size > maxBytes) {
              window.alert(`檔案過大，請上傳小於 ${maxPaintingUploadSizeMB}MB 的檔案。`);
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
              window.alert("目前僅支援 png/jpg/jpeg/webp/mp4/webm/ogg/pdf/docx。");
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
                window.alert("圖片讀取失敗，請重新上傳。");
              };
              reader.readAsDataURL(file);
            } else {
              finishUpdate(URL.createObjectURL(file));
            }

            e.currentTarget.value = "";
          }}
        />
        <p className="mt-1 text-xs text-white/65">限制：{maxPaintingUploadSizeMB}MB 以內，建議影片使用 mp4(web/h264)。</p>
        {selectedItem.fileName && <p className="mt-1 text-xs text-white/65">目前檔案：{selectedItem.fileName}</p>}
      </div>

      {selectedItemIsVideo && (
        <div className="space-y-3 rounded-2xl border border-indigo-200/60 bg-indigo-300/12 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md">
          <p className="text-xs font-semibold text-white">影片播放設定</p>
          <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={Boolean(selectedItem.videoAutoplay)} onChange={(e) => updateItem(selectedItem.id, { videoAutoplay: e.target.checked })} />自動播放</label>
          <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={Boolean(selectedItem.videoLoop)} onChange={(e) => updateItem(selectedItem.id, { videoLoop: e.target.checked })} />循環播放</label>
          <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={selectedItem.videoMuted ?? true} onChange={(e) => updateItem(selectedItem.id, { videoMuted: e.target.checked })} />靜音播放</label>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/75">自訂封面圖（png/jpg/webp）</label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);
                if (!isImage) {
                  window.alert("封面圖僅支援 png/jpg/jpeg/webp");
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
              <p className="mb-1 text-xs text-white/65">目前封面預覽</p>
              <img src={selectedItem.videoThumbnailUrl} alt="影片封面" className="max-h-40 w-full rounded border border-white/25 bg-white object-contain" />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">畫框寬度</label>
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
          <label className="mb-1 block text-xs font-medium text-white/75">畫框高度</label>
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

      <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={keepFrameAspectRatio} onChange={(e) => setKeepFrameAspectRatio(e.target.checked)} />維持比例</label>
      <button onClick={() => setAllPaintingFrameSize(selectedItem.frameWidth ?? 2, selectedItem.frameHeight ?? 1.5)} className="w-full rounded-xl border border-indigo-200/70 bg-indigo-500/20 px-2 py-1.5 text-xs font-medium text-white shadow-[0_6px_18px_rgba(79,70,229,0.12)] backdrop-blur-md transition-colors hover:bg-indigo-500/28">套用目前畫框尺寸到全部畫作</button>
      <div><label className="mb-1 block text-xs font-medium text-white/75">作品標題</label><input type="text" value={selectedItem.title || ""} onChange={(e) => updateItem(selectedItem.id, { title: e.target.value })} className="w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/55" placeholder="請輸入作品標題" /></div>
      <div><label className="mb-1 block text-xs font-medium text-white/75">作者</label><input type="text" value={selectedItem.artist || ""} onChange={(e) => updateItem(selectedItem.id, { artist: e.target.value })} className="w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/55" placeholder="請輸入作者" /></div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-white/75">作品描述</label>
          <div className="flex gap-1">
            <button
              onClick={async () => {
                const desc = selectedItem.description;
                if (!desc || !desc.trim()) return;
                setWritingLoading("polish");
                try {
                  const token = loadAuth();
                  const { result } = await requestPolishIntro(token, { text: desc });
                  updateItem(selectedItem.id, { description: result });
                  toast.success("潤飾完成");
                } catch (e: any) {
                  toast.error(e?.message || "潤飾失敗");
                } finally {
                  setWritingLoading(null);
                }
              }}
              disabled={!!writingLoading}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] disabled:opacity-50 ${glassButtonClass}`}
            >
              {writingLoading === "polish" ? <Loader2 className="size-3 animate-spin" /> : null}潤飾
            </button>
            <button
              onClick={async () => {
                const desc = selectedItem.description;
                if (!desc || !desc.trim()) return;
                setWritingLoading("en");
                try {
                  const token = loadAuth();
                  const { result } = await requestTranslate(token, { text: desc, targetLanguage: "英文" });
                  toast.success(`英文翻譯：${result}`);
                } catch (e: any) {
                  toast.error(e?.message || "翻譯失敗");
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
                  const token = loadAuth();
                  const { result } = await requestTranslate(token, { text: desc, targetLanguage: "葡萄牙文" });
                  toast.success(`葡萄牙文翻譯：${result}`);
                } catch (e: any) {
                  toast.error(e?.message || "翻譯失敗");
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
        <textarea value={selectedItem.description || ""} onChange={(e) => updateItem(selectedItem.id, { description: e.target.value })} className={`h-24 w-full rounded-xl px-3 py-2 text-sm ${glassInputClass}`} placeholder="請輸入作品描述" />
      </div>
      <div className="rounded-2xl border border-violet-200/60 bg-violet-300/12 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md">
        <p className="mb-2 text-xs font-semibold text-white">語音導覽</p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void playGuideAudio()} disabled={isTtsGenerating} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70">{isTtsGenerating ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}{isTtsGenerating ? "產生中..." : "播放語音導覽"}</button>
          {isTtsSpeaking && <button onClick={stopGuideAudio} className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-white transition-colors ${glassButtonClass}`}><StopIcon className="size-4" />停止</button>}
        </div>
        {ttsError && <p className="mt-2 text-xs text-rose-300">{ttsError}</p>}
      </div>
      <div><label className="mb-1 block text-xs font-medium text-white/75">外部連結</label><input type="text" value={selectedItem.externalUrl || ""} onChange={(e) => updateItem(selectedItem.id, { externalUrl: e.target.value })} className="w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/55" placeholder="https://..." /></div>
    </div>
  );
}
