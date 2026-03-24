import { Image, Square, Type, Columns, Volume2, Loader2, Square as StopIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";
import { generateGuideTts } from "../../../api/client";

export function StudioEditPanel() {
  const mode = useMetaverseStudioStore((s) => s.mode);
  const setMode = useMetaverseStudioStore((s) => s.setMode);
  const roomSize = useMetaverseStudioStore((s) => s.roomSize);
  const setRoomSize = useMetaverseStudioStore((s) => s.setRoomSize);
  const addItem = useMetaverseStudioStore((s) => s.addItem);
  const selectedItemId = useMetaverseStudioStore((s) => s.selectedItemId);
  const items = useMetaverseStudioStore((s) => s.items);
  const updateItem = useMetaverseStudioStore((s) => s.updateItem);
  const removeItem = useMetaverseStudioStore((s) => s.removeItem);

  if (mode !== "edit") return null;

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const handleStopGuide = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  };

  const handlePlayGuide = async () => {
    if (!selectedItem || selectedItem.type !== "painting") return;

    setTtsError(null);
    setIsGenerating(true);

    try {
      const blob = await generateGuideTts({
        title: selectedItem.title || "",
        artist: selectedItem.artist || "",
        description: selectedItem.description || selectedItem.content || "",
      });

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        setTtsError("播放語音失敗");
        setIsSpeaking(false);
      };

      await audio.play();
      setIsSpeaking(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "語音導覽產生失敗";
      setTtsError(message);
      setIsSpeaking(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <div className="absolute left-4 top-4 pointer-events-auto rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-800">3D 展館編輯器</div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white" onClick={() => setMode("view")}>觀展模式</button>
          <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white" onClick={() => setMode("floor-plan")}>平面圖模式</button>
        </div>
      </div>

      <div className="absolute left-4 top-24 pointer-events-auto rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-md border p-2 text-slate-700 hover:bg-slate-50" title="新增畫作" onClick={() => addItem("painting")}><Image className="size-4" /></button>
          <button className="rounded-md border p-2 text-slate-700 hover:bg-slate-50" title="新增展台" onClick={() => addItem("pedestal")}><Square className="size-4" /></button>
          <button className="rounded-md border p-2 text-slate-700 hover:bg-slate-50" title="新增文字" onClick={() => addItem("text")}><Type className="size-4" /></button>
          <button className="rounded-md border p-2 text-slate-700 hover:bg-slate-50" title="新增隔間" onClick={() => addItem("partition")}><Columns className="size-4" /></button>
        </div>
      </div>

      <div className="absolute left-24 top-24 w-72 pointer-events-auto rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm">
        <div className="mb-2 text-xs font-semibold text-slate-700">空間設定</div>
        <label className="mb-2 block text-xs text-slate-600">寬度 {roomSize.width}m
          <input className="w-full" type="range" min={10} max={50} value={roomSize.width} onChange={(e) => setRoomSize({ width: Number(e.target.value) })} />
        </label>
        <label className="mb-2 block text-xs text-slate-600">長度 {roomSize.length}m
          <input className="w-full" type="range" min={10} max={50} value={roomSize.length} onChange={(e) => setRoomSize({ length: Number(e.target.value) })} />
        </label>
        <label className="mb-2 block text-xs text-slate-600">高度 {roomSize.height}m
          <input className="w-full" type="range" min={4} max={14} value={roomSize.height} onChange={(e) => setRoomSize({ height: Number(e.target.value) })} />
        </label>
        <label className="mb-2 block text-xs text-slate-600">牆色
          <input className="h-8 w-full" type="color" value={roomSize.wallColor} onChange={(e) => setRoomSize({ wallColor: e.target.value })} />
        </label>
        <label className="block text-xs text-slate-600">地板色
          <input className="h-8 w-full" type="color" value={roomSize.floorColor} onChange={(e) => setRoomSize({ floorColor: e.target.value })} />
        </label>
      </div>

      {selectedItem && (
        <div className="absolute right-0 top-0 h-full w-80 pointer-events-auto border-l border-slate-200 bg-white/95 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">展品屬性</div>
            <button className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700" onClick={() => removeItem(selectedItem.id)}>刪除</button>
          </div>

          {selectedItem.type === "painting" && (
            <div className="space-y-2">
              <label className="block text-xs text-slate-600">圖片網址
                <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={selectedItem.content} onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })} />
              </label>
              <label className="block text-xs text-slate-600">標題
                <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={selectedItem.title || ""} onChange={(e) => updateItem(selectedItem.id, { title: e.target.value })} />
              </label>
              <label className="block text-xs text-slate-600">作者
                <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={selectedItem.artist || ""} onChange={(e) => updateItem(selectedItem.id, { artist: e.target.value })} />
              </label>
              <label className="block text-xs text-slate-600">作品描述
                <textarea className="mt-1 h-24 w-full rounded border px-2 py-1 text-sm" value={selectedItem.description || ""} onChange={(e) => updateItem(selectedItem.id, { description: e.target.value })} />
              </label>

              <div className="pt-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={handlePlayGuide}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
                  {isGenerating ? "產生中..." : "播放語音導覽"}
                </button>

                {isSpeaking && (
                  <button
                    className="ml-2 inline-flex items-center gap-2 rounded-md bg-slate-200 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-300"
                    onClick={handleStopGuide}
                  >
                    <StopIcon className="size-4" />
                    停止
                  </button>
                )}

                {ttsError && <p className="mt-2 text-xs text-rose-600">{ttsError}</p>}
              </div>
            </div>
          )}

          {selectedItem.type === "text" && (
            <label className="block text-xs text-slate-600">文字內容
              <textarea className="mt-1 h-28 w-full rounded border px-2 py-1 text-sm" value={selectedItem.content} onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
