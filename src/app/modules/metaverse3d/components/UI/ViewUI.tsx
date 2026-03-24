import { useStore } from "../../store/useStore";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function ViewUI() {
  const {
    mode,
    setMode,
    items,
    viewingItem,
    setViewingItem,
    openNextViewingItem,
    openPrevViewingItem,

  } = useStore();

  const lockPointerToCanvas = () => {
    const canvas = document.querySelector<HTMLCanvasElement>("#view-canvas-container canvas");
    if (!canvas) return;
    if (document.pointerLockElement === canvas) return;
    void canvas.requestPointerLock();
  };

  const closeViewingItem = () => {
    setViewingItem(null);
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          lockPointerToCanvas();
        });
      });
    }, 120);
  };

  useEffect(() => {
    if (viewingItem && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [viewingItem]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "view" || !viewingItem) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        openNextViewingItem();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        openPrevViewingItem();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, viewingItem, openNextViewingItem, openPrevViewingItem]);

  const paintings = items.filter((item) => item.type === "painting");
  const paintingCount = paintings.length;
  const currentPaintingIndex = viewingItem
    ? paintings.findIndex((item) => item.id === viewingItem.id)
    : -1;

  const inferredMimeType = useMemo(() => {
    const content = String(viewingItem?.content || "").trim().toLowerCase();
    if (!content) return "";
    if (content.startsWith("data:image/")) return "image/*";
    if (content.startsWith("data:video/")) return "video/*";
    if (content.startsWith("data:application/pdf")) return "application/pdf";
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(content)) return "image/*";
    if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/.test(content)) return "video/*";
    if (/\.(pdf)(\?|#|$)/.test(content)) return "application/pdf";
    return "";
  }, [viewingItem?.content]);

  const effectiveMimeType = viewingItem?.fileMimeType || inferredMimeType;
  const isImageAsset = effectiveMimeType.startsWith("image/");
  const isVideoAsset = effectiveMimeType.startsWith("video/");
  const isPdfAsset = effectiveMimeType === "application/pdf";

  const fallbackImageUrl =
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=1200";
  const [safeModalImageSrc, setSafeModalImageSrc] = useState<string>(fallbackImageUrl);

  useEffect(() => {
    if (!viewingItem || !isImageAsset) {
      setSafeModalImageSrc(fallbackImageUrl);
      return;
    }

    const candidate = String(viewingItem.content || "").trim();
    if (!candidate) {
      setSafeModalImageSrc(fallbackImageUrl);
      return;
    }

    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => setSafeModalImageSrc(candidate);
    probe.onerror = () => setSafeModalImageSrc(fallbackImageUrl);
    probe.src = candidate;
  }, [viewingItem, isImageAsset]);

  if (mode !== "view") return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <div className="absolute top-4 left-4 pointer-events-auto">
        <button
          onClick={() => {
            document.exitPointerLock();
            setMode("edit");
          }}
          className="px-4 py-2 bg-slate-900/70 backdrop-blur-md text-cyan-100 font-medium rounded-lg shadow-sm hover:bg-slate-900/85 transition-colors border border-cyan-300/35"
        >
          離開觀展
        </button>
      </div>

      {!viewingItem && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/70 backdrop-blur-md text-cyan-50 px-6 py-3 rounded-full text-sm font-medium tracking-wide shadow-lg border border-cyan-300/30">
          點擊後可自由視角 • WASD 移動 • 點擊畫作查看詳情
        </div>
      )}

      {viewingItem && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto flex items-center justify-center p-4 md:p-8 z-50"
          onPointerDown={() => {
            if (document.pointerLockElement) {
              document.exitPointerLock();
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeViewingItem();
              }}
              className="absolute top-4 right-4 p-2 bg-gray-100/80 hover:bg-gray-200 rounded-full transition-colors z-10 backdrop-blur-sm"
            >
              <X className="w-5 h-5 text-gray-800" />
            </button>

            <div className="md:w-1/2 bg-gray-100 flex items-center justify-center p-8 min-h-[40vh]">
              {isImageAsset && (
                <img
                  src={safeModalImageSrc}
                  alt={viewingItem.title || "藝術作品"}
                  className="max-w-full max-h-[70vh] object-contain shadow-md rounded-sm"
                  onError={(e) => {
                    if (e.currentTarget.src !== fallbackImageUrl) {
                      e.currentTarget.src = fallbackImageUrl;
                    }
                  }}
                />
              )}

              {isVideoAsset && (
                <video
                  src={viewingItem.content}
                  controls
                  playsInline
                  autoPlay={Boolean(viewingItem.videoAutoplay)}
                  loop={Boolean(viewingItem.videoLoop)}
                  muted={viewingItem.videoMuted ?? true}
                  poster={viewingItem.videoThumbnailUrl}
                  className="w-full max-h-[70vh] rounded-md border border-gray-300 bg-black"
                >
                  您的瀏覽器不支援影片播放。
                </video>
              )}

              {isPdfAsset && (
                <iframe
                  src={viewingItem.content}
                  title={viewingItem.title || "PDF 文件"}
                  className="w-full h-[70vh] rounded-md border border-gray-300 bg-white"
                />
              )}

              {!isImageAsset && !isVideoAsset && !isPdfAsset && (
                <div className="text-center space-y-3">
                  <p className="text-sm text-gray-700">此檔案類型無法直接預覽</p>
                  <p className="text-xs text-gray-500">{viewingItem.fileName || "未命名檔案"}</p>
                  {viewingItem.content && (
                    <a
                      href={viewingItem.content}
                      download={viewingItem.fileName || "exhibit-file"}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      下載檔案
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center overflow-y-auto bg-white">
              <h2 className="text-3xl font-bold text-gray-900 mb-3 font-serif">
                {viewingItem.title || "未命名"}
              </h2>

              <p className="text-sm font-medium text-indigo-700 mb-4">
                作者：{viewingItem.artist || "未知作者"}
              </p>

              <div className="w-12 h-1 bg-indigo-600 mb-4"></div>

              {paintingCount > 0 && currentPaintingIndex >= 0 && (
                <div className="mb-5">
                  <p className="text-xs text-gray-500">
                    作品 {currentPaintingIndex + 1} / {paintingCount}
                  </p>
                </div>
              )}

              <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-wrap mb-6">
                {viewingItem.description || "暫無作品描述。"}
              </p>

              {viewingItem.externalUrl && (
                <a
                  href={viewingItem.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  查看更多資訊
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}


            </div>
          </div>
        </div>
      )}
    </div>
  );
}
