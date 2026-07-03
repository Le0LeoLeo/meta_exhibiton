import { useState } from "react";
import type { CuratorPlanRequest, CuratorPlanResponse } from "@/app/api/aiCurator";
import { requestCuratorPlan as defaultRequestCuratorPlan } from "@/app/api/aiCurator";
import {
  mapCuratorPlanToScene,
  type CuratorSceneApplyMode,
  type SceneSnapshot,
} from "../../aiCurator/mapCuratorPlanToScene";

type AiCuratorPanelProps = {
  token: string | null;
  currentScene: SceneSnapshot | null;
  importScene: (scene: SceneSnapshot) => void;
  onApplied?: () => void;
  requestCuratorPlan?: (
    token: string,
    payload: CuratorPlanRequest,
  ) => Promise<CuratorPlanResponse>;
};

const copy = {
  title: "AI \u7b56\u5c55\u52a9\u624b",
  signInError: "\u8acb\u5148\u767b\u5165\u518d\u4f7f\u7528 AI \u7b56\u5c55\u3002",
  failed: "AI \u7b56\u5c55\u751f\u6210\u5931\u6557",
  theme: "\u5c55\u89bd\u4e3b\u984c",
  themePlaceholder: "\u4f8b\u5982\uff1a\u6fb3\u9580\u975e\u907a\u6587\u5316\u5c55",
  style: "\u98a8\u683c",
  whiteBox: "\u767d\u76d2\u5c55\u5ef3",
  warmMuseum: "\u6eab\u6696\u535a\u7269\u9928",
  techShowroom: "\u79d1\u6280\u5c55\u5ef3",
  historyGallery: "\u6b77\u53f2\u5c55\u5ef3",
  immersive: "\u6c89\u6d78\u5f0f",
  exhibits: "\u5c55\u54c1\u6578",
  audience: "\u76ee\u6a19\u89c0\u773e",
  audiencePlaceholder: "\u4f8b\u5982\uff1a\u4e2d\u5b78\u751f\u3001\u89aa\u5b50\u89c0\u773e\u3001\u4f01\u696d\u8a2a\u5ba2",
  language: "\u8a9e\u8a00",
  zhTw: "\u7e41\u9ad4\u4e2d\u6587",
  zhCn: "\u7c21\u9ad4\u4e2d\u6587",
  applyMode: "\u5957\u7528\u65b9\u5f0f",
  replace: "\u91cd\u5efa\u5c55\u5ef3",
  preserveExisting: "\u4fdd\u7559\u73fe\u6709\u5c55\u54c1",
  generating: "\u751f\u6210\u4e2d...",
  generate: "\u751f\u6210\u7b56\u5c55\u65b9\u6848",
  preview: "\u7b56\u5c55\u9810\u89bd",
  replaceWarning: "\u5373\u5c07\u53d6\u4ee3\u76ee\u524d\u5c55\u5ef3\u8349\u7a3f",
  preserveWarning: "\u5373\u5c07\u4fdd\u7559\u73fe\u6709\u5c55\u54c1\u4e26\u52a0\u5165 AI \u8349\u7a3f",
  confirmHint: "\u78ba\u8a8d\u5f8c\u6703\u628a\u6b64 AI \u7b56\u5c55\u8349\u7a3f\u5957\u7528\u5230\u76ee\u524d\u7de8\u8f2f\u5668\u3002",
  confirmApply: "\u78ba\u8a8d\u5957\u7528",
  applyToScene: "\u5957\u7528\u5230\u5c55\u5ef3",
  backToPreview: "\u8fd4\u56de\u9810\u89bd",
  discard: "\u6368\u68c4",
};

function formatGeneratedCounts(sectionCount: number, exhibitCount: number) {
  return `${sectionCount} \u500b\u5c55\u5340 / ${exhibitCount} \u4ef6\u5c55\u54c1`;
}

export function AiCuratorPanel({
  token,
  currentScene,
  importScene,
  onApplied,
  requestCuratorPlan = defaultRequestCuratorPlan,
}: AiCuratorPanelProps) {
  const [theme, setTheme] = useState("");
  const [style, setStyle] = useState("white-box");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState<"zh-TW" | "zh-CN" | "en">("zh-TW");
  const [exhibitCount, setExhibitCount] = useState(6);
  const [applyMode, setApplyMode] = useState<CuratorSceneApplyMode>("replace");
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<CuratorPlanResponse | null>(null);
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
    setIsConfirmingApply(false);
    setIsGenerating(true);
    try {
      const result = await requestCuratorPlan(token, {
        theme: theme.trim(),
        style,
        audience: audience.trim() || undefined,
        language,
        exhibitCount,
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed);
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
    setIsConfirmingApply(false);
  };

  const generatedSectionCount = preview?.exhibition.sections.length ?? 0;
  const generatedExhibitCount = preview?.exhibition.exhibits.length ?? 0;
  const applyWarning = applyMode === "preserve-existing" ? copy.preserveWarning : copy.replaceWarning;

  return (
    <div className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-slate-900">
      <h4 className="text-xs font-semibold text-slate-950">{copy.title}</h4>

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
