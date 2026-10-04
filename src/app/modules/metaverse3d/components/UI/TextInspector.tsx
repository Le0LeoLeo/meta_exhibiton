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
  const [aiResult, setAiResult] = useState<{ kind: "polish" | "translation"; text: string; language?: string } | null>(null);

  const handlePolish = async () => {
    const auth = loadAuth();
    if (!auth.token) { toast.error(t('textTools.signInRequired')); return; }
    setAiLoading("polish");
    try {
      const res = await requestPolishIntro(auth.token, { text: selectedItem.content });
      setAiResult({ kind: "polish", text: res.result });
      toast.success(t('textTools.resultReady'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('textTools.polishFailed'));
    } finally {
      setAiLoading(null);
    }
  };

  const handleTranslate = async (targetLanguage: string, language: string) => {
    const auth = loadAuth();
    if (!auth.token) { toast.error(t('textTools.signInRequired')); return; }
    setAiLoading(targetLanguage);
    try {
      const res = await requestTranslate(auth.token, { text: selectedItem.content, targetLanguage });
      setAiResult({ kind: "translation", text: res.result, language });
      toast.success(t('textTools.resultReady'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('textTools.translationFailed'));
    } finally {
      setAiLoading(null);
    }
  };

  const copyResult = async () => {
    if (!aiResult) return;
    try {
      await navigator.clipboard.writeText(aiResult.text);
      toast.success(t('textTools.copied'));
    } catch {
      toast.error(t('textTools.copyFailed'));
    }
  };

  const applyResult = () => {
    if (!aiResult) return;
    updateItem(selectedItem.id, { content: aiResult.text });
    setAiResult(null);
  };

  return (
    <div className="space-y-3 text-white">
      <textarea aria-label={t('editorTextContent')} value={selectedItem.content} onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })} className={`h-32 w-full rounded-xl px-3 py-2 text-sm ${glassInputClass}`} />

      <div className="flex gap-1.5">
        <button onClick={handlePolish} disabled={aiLoading !== null} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50">
          {aiLoading === "polish" ? "..." : t('textTools.polish')}
        </button>
        <button onClick={() => handleTranslate("en", t('textTools.english'))} disabled={aiLoading !== null} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50">
          {aiLoading === "en" ? "..." : t('textTools.english')}
        </button>
        <button onClick={() => handleTranslate("zh-CN", t('textTools.simplifiedChinese'))} disabled={aiLoading !== null} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50">
          {aiLoading === "zh-CN" ? "..." : t('textTools.simplifiedChinese')}
        </button>
        <button onClick={() => handleTranslate("pt", t('textTools.portuguese'))} disabled={aiLoading !== null} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50">
          {aiLoading === "pt" ? "..." : t('textTools.portuguese')}
        </button>
      </div>

      {aiResult && (
        <section aria-label={t('textTools.result')} className="space-y-2 rounded-lg border border-white/20 bg-black/15 p-3">
          <div className="text-xs font-medium text-white/80">
            {aiResult.kind === "polish" ? t('textTools.polishedResult') : t('textTools.translationResult', { language: aiResult.language ?? "" })}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-white">{aiResult.text}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={applyResult} className="rounded-md border border-white/25 bg-white/15 px-2 py-1 text-xs text-white hover:bg-white/25">{t('textTools.apply')}</button>
            <button onClick={copyResult} className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20">{t('textTools.copy')}</button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">{t('editorTextFont')}</label>
          <select aria-label={t('editorTextFont')} value={selectedItem.textFontFamily || "sans"} onChange={(e) => updateItem(selectedItem.id, { textFontFamily: e.target.value as "sans" | "serif" | "mono" })} className="w-full rounded-md border border-white/25 bg-white/10 px-2 py-1.5 text-sm text-white">
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">{t('editorTextSize')}</label>
          <input type="number" aria-label={t('editorTextSize')} min="0.2" max="2" step="0.05" value={selectedItem.textFontSize ?? 0.5} onChange={(e) => updateItem(selectedItem.id, { textFontSize: Number(e.target.value) || 0.5 })} className="w-full rounded-md border border-white/25 bg-white/10 px-2 py-1.5 text-sm text-white" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-white/75">{t('editorTextColor')}</label>
        <input type="color" aria-label={t('editorTextColor')} value={selectedItem.textColor || "#ffffff"} onChange={(e) => updateItem(selectedItem.id, { textColor: e.target.value })} className="h-9 w-full rounded-md border border-white/25 bg-white/10" />
      </div>

      <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={Boolean(selectedItem.textIsBold)} onChange={(e) => updateItem(selectedItem.id, { textIsBold: e.target.checked })} />{t('editorTextBold')}</label>
      <label className="flex items-center gap-2 text-sm text-white/85"><input type="checkbox" checked={Boolean(selectedItem.textBackboardEnabled)} onChange={(e) => updateItem(selectedItem.id, { textBackboardEnabled: e.target.checked })} />{t('editorTextBackboard')}</label>

      {selectedItem.textBackboardEnabled && (
        <div>
          <label className="mb-1 block text-xs font-medium text-white/75">{t('editorTextBackboardColor')}</label>
          <input type="color" aria-label={t('editorTextBackboardColor')} value={selectedItem.textBackboardColor || "#ffffff"} onChange={(e) => updateItem(selectedItem.id, { textBackboardColor: e.target.value })} className="h-9 w-full rounded-md border border-white/25 bg-white/10" />
        </div>
      )}
    </div>
  );
}
