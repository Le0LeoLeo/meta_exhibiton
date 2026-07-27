import { useState } from "react";
import { ExhibitItem } from "../../types";
import { useI18n } from "../../../../components/I18nProvider";
import { requestPolishIntro, requestTranslate } from "../../../../api/aiWriting";
import { loadAuth } from "../../../../api/client";
import { toast } from "sonner";

type Props = {
  selectedItem: ExhibitItem;
  glassInputClass: string;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
};

export function TextInspector({ selectedItem, glassInputClass, updateItem }: Props) {
  const { t } = useI18n();
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const handlePolish = async () => {
    const auth = loadAuth();
    if (!auth.token) { toast.error("請先登入"); return; }
    setAiLoading("polish");
    try {
      const res = await requestPolishIntro(auth.token, { text: selectedItem.content });
      updateItem(selectedItem.id, { content: res.result });
      toast.success("潤飾完成");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "潤飾失敗");
    } finally {
      setAiLoading(null);
    }
  };

  const handleTranslate = async (targetLanguage: string, label: string) => {
    const auth = loadAuth();
    if (!auth.token) { toast.error("請先登入"); return; }
    setAiLoading(label);
    try {
      const res = await requestTranslate(auth.token, { text: selectedItem.content, targetLanguage });
      toast.success(`${label} 翻譯完成`, { description: res.result });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : `${label} 翻譯失敗`);
    } finally {
      setAiLoading(null);
    }
  };

  return (
    <div className="space-y-3 text-white">
      <textarea value={selectedItem.content} onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })} className={`h-32 w-full rounded-xl px-3 py-2 text-sm ${glassInputClass}`} />

      <div className="flex gap-1.5">
        <button onClick={handlePolish} disabled={aiLoading !== null} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50">
          {aiLoading === "polish" ? "..." : "潤飾"}
        </button>
        <button onClick={() => handleTranslate("en", "EN")} disabled={aiLoading !== null} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50">
          {aiLoading === "EN" ? "..." : "EN"}
        </button>
        <button onClick={() => handleTranslate("zh-CN", "簡中")} disabled={aiLoading !== null} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50">
          {aiLoading === "簡中" ? "..." : "簡中"}
        </button>
        <button onClick={() => handleTranslate("pt", "PT")} disabled={aiLoading !== null} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50">
          {aiLoading === "PT" ? "..." : "PT"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">{t('editorTextFont')}</label>
          <select value={selectedItem.textFontFamily || "sans"} onChange={(e) => updateItem(selectedItem.id, { textFontFamily: e.target.value as "sans" | "serif" | "mono" })} className="w-full rounded-md border border-white/25 bg-white/10 px-2 py-1.5 text-sm text-white">
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">{t('editorTextSize')}</label>
          <input type="number" min="0.2" max="2" step="0.05" value={selectedItem.textFontSize ?? 0.5} onChange={(e) => updateItem(selectedItem.id, { textFontSize: Number(e.target.value) || 0.5 })} className="w-full rounded-md border border-white/25 bg-white/10 px-2 py-1.5 text-sm text-white" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-white/75">{t('editorTextColor')}</label>
        <input type="color" value={selectedItem.textColor || "#ffffff"} onChange={(e) => updateItem(selectedItem.id, { textColor: e.target.value })} className="h-9 w-full rounded-md border border-white/25 bg-white/10" />
      </div>

      <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={Boolean(selectedItem.textIsBold)} onChange={(e) => updateItem(selectedItem.id, { textIsBold: e.target.checked })} />{t('editorTextBold')}</label>
      <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={Boolean(selectedItem.textBackboardEnabled)} onChange={(e) => updateItem(selectedItem.id, { textBackboardEnabled: e.target.checked })} />{t('editorTextBackboard')}</label>

      {selectedItem.textBackboardEnabled && (
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">{t('editorTextBackboardColor')}</label>
          <input type="color" value={selectedItem.textBackboardColor || "#ffffff"} onChange={(e) => updateItem(selectedItem.id, { textBackboardColor: e.target.value })} className="h-9 w-full rounded-md border border-white/25 bg-white/10" />
        </div>
      )}
    </div>
  );
}
