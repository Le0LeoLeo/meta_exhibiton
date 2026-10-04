import { useState } from "react";
import type { CuratorPlanRequest, CuratorPlanResponse } from "@/app/api/aiCurator";
import { requestCuratorPlan as defaultRequestCuratorPlan } from "@/app/api/aiCurator";
import {
  mapCuratorPlanToScene,
  type CuratorSceneApplyMode,
  type SceneSnapshot,
} from "../../aiCurator/mapCuratorPlanToScene";
import {
  aiCuratorCopy as copy,
  curatorIntentOptions,
  formatGeneratedCounts,
  getCuratorIntentLabel,
  type CuratorIntent,
} from "./aiCuratorCopy";

type HumanizedCuratorPlanRequest = CuratorPlanRequest & { intent: CuratorIntent };

type AiCuratorPanelProps = {
  token: string | null;
  currentScene: SceneSnapshot | null;
  importScene: (scene: SceneSnapshot) => void;
  onApplied?: () => void;
  requestCuratorPlan?: (
    token: string,
    payload: HumanizedCuratorPlanRequest,
  ) => Promise<CuratorPlanResponse>;
};

export function AiCuratorPanel({
  token,
  currentScene,
  importScene,
  onApplied,
  requestCuratorPlan = defaultRequestCuratorPlan,
}: AiCuratorPanelProps) {
  const [theme, setTheme] = useState("");
  const [intent, setIntent] = useState<CuratorIntent>("warm-memory");
  const [style, setStyle] = useState("white-box");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState<"zh-TW" | "zh-CN" | "en">("zh-TW");
  const [exhibitCount, setExhibitCount] = useState(6);
  const [applyMode, setApplyMode] = useState<CuratorSceneApplyMode>("preserve-existing");
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<CuratorPlanResponse | null>(null);
  const [previewIntent, setPreviewIntent] = useState<CuratorIntent | null>(null);
  const [isConfirmingApply, setIsConfirmingApply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = Boolean(theme.trim()) && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (!token) {
      setError(copy.signInError);
      return;
    }

    setError(null);
    setPreview(null);
    setPreviewIntent(null);
    setIsConfirmingApply(false);
    setIsGenerating(true);
    try {
      const payload: HumanizedCuratorPlanRequest = {
        theme: theme.trim(),
        intent,
        style,
        audience: audience.trim() || undefined,
        language,
        exhibitCount,
      };
      const result = await requestCuratorPlan(token, payload);
      setPreview(result);
      setPreviewIntent(intent);
    } catch (err) {
      const detail = err instanceof Error ? err.message : copy.failed;
      setError(`${copy.unchangedError} ${detail}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartApply = () => {
    if (!preview) return;
    setIsConfirmingApply(true);
  };

  const handleApply = () => {
    if (!preview) return;
    importScene(mapCuratorPlanToScene(preview, currentScene, { applyMode }));
    onApplied?.();
  };

  const handleDiscardPreview = () => {
    setPreview(null);
    setPreviewIntent(null);
    setIsConfirmingApply(false);
  };

  const generatedSectionCount = preview?.exhibition.sections.length ?? 0;
  const generatedExhibitCount = preview?.exhibition.exhibits.length ?? 0;
  const applyWarning = applyMode === "preserve-existing" ? copy.preserveWarning : copy.replaceWarning;

  return (
    <div className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-slate-900">
      <h4 className="text-xs font-semibold text-slate-950">{copy.title}</h4>
      <p className="text-[11px] leading-relaxed text-slate-700">{copy.scope}</p>

      <label className="block text-[11px] text-slate-700">
        {copy.theme}
        <textarea
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          className="mt-1 min-h-20 w-full resize-none rounded-xl border border-cyan-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400"
          placeholder={copy.themePlaceholder}
          maxLength={500}
        />
      </label>

      <label className="block text-[11px] text-slate-700">
        {copy.intent}
        <select
          value={intent}
          onChange={(event) => setIntent(event.target.value as CuratorIntent)}
          className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900"
        >
          {curatorIntentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-slate-700">
          {copy.style}
          <select
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900"
          >
            <option value="white-box">{copy.whiteBox}</option>
            <option value="warm-museum">{copy.warmMuseum}</option>
            <option value="tech-showroom">{copy.techShowroom}</option>
            <option value="history-gallery">{copy.historyGallery}</option>
            <option value="immersive">{copy.immersive}</option>
          </select>
        </label>
        <label className="block text-[11px] text-slate-700">
          {copy.exhibits}
          <input
            type="number"
            min={3}
            max={12}
            value={exhibitCount}
            onChange={(event) => setExhibitCount(Math.max(3, Math.min(12, Number(event.target.value) || 6)))}
            className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900"
          />
        </label>
      </div>

      <label className="block text-[11px] text-slate-700">
        {copy.audience}
        <input
          value={audience}
          onChange={(event) => setAudience(event.target.value)}
          className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
          placeholder={copy.audiencePlaceholder}
          maxLength={120}
        />
      </label>

      <label className="block text-[11px] text-slate-700">
        {copy.language}
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as "zh-TW" | "zh-CN" | "en")}
          className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900"
        >
          <option value="zh-TW">{copy.zhTw}</option>
          <option value="zh-CN">{copy.zhCn}</option>
          <option value="en">English</option>
        </select>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-[11px] text-slate-700">{copy.applyMode}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1 rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-[11px] text-slate-700">
            <input
              type="radio"
              name="ai-curator-apply-mode"
              value="replace"
              checked={applyMode === "replace"}
              onChange={() => setApplyMode("replace")}
            />
            {copy.replace}
          </label>
          <label className="flex items-center gap-1 rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-[11px] text-slate-700">
            <input
              type="radio"
              name="ai-curator-apply-mode"
              value="preserve-existing"
              checked={applyMode === "preserve-existing"}
              onChange={() => setApplyMode("preserve-existing")}
            />
            {copy.preserveExisting}
          </label>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full rounded-xl border border-cyan-600 bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? copy.generating : copy.generate}
      </button>

      {preview && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-slate-900">
          <div>
            <p className="text-[11px] font-semibold text-emerald-700">{copy.preview}</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{preview.exhibition.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{preview.exhibition.introduction}</p>
            <p className="mt-1 rounded-lg border border-emerald-100 bg-white px-2 py-1.5 text-[11px] text-emerald-800">
              {copy.intentSummary}：{getCuratorIntentLabel(previewIntent ?? intent)}
            </p>
          </div>

          <div className="space-y-1">
            {preview.exhibition.sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-emerald-100 bg-white px-2 py-1.5">
                <p className="font-semibold">{section.title}</p>
                <p className="text-slate-600">{section.summary}</p>
              </div>
            ))}
          </div>

          <p className="rounded-lg border border-emerald-100 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-slate-600">
            {preview.exhibition.guideOpening}
          </p>

          {preview.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {isConfirmingApply && (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
              <p className="font-semibold">{applyWarning}</p>
              <p>{formatGeneratedCounts(generatedSectionCount, generatedExhibitCount)}</p>
              <p>{copy.preserveDetail}</p>
              <p>{copy.changeDetail}</p>
              <p>{copy.confirmHint}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={isConfirmingApply ? handleApply : handleStartApply}
              className="rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              {isConfirmingApply ? copy.confirmApply : copy.applyToScene}
            </button>
            <button
              type="button"
              onClick={isConfirmingApply ? () => setIsConfirmingApply(false) : handleDiscardPreview}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {isConfirmingApply ? copy.backToPreview : copy.discard}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
