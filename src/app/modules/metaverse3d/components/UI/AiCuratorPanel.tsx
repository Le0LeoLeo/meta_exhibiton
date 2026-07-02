import { useState } from "react";
import type { CuratorPlanRequest, CuratorPlanResponse } from "@/app/api/aiCurator";
import { requestCuratorPlan as defaultRequestCuratorPlan } from "@/app/api/aiCurator";
import {
  mapCuratorPlanToScene,
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<CuratorPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = Boolean(theme.trim()) && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (!token) {
      setError("Please sign in before using AI Curator.");
      return;
    }

    setError(null);
    setPreview(null);
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
      setError(err instanceof Error ? err.message : "AI Curator failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    importScene(mapCuratorPlanToScene(preview, currentScene));
    onApplied?.();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-slate-900">
      <h4 className="text-xs font-semibold text-slate-950">AI Curator</h4>

      <label className="block text-[11px] text-slate-700">
        Exhibition theme
        <textarea
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          className="mt-1 min-h-20 w-full resize-none rounded-xl border border-cyan-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400"
          placeholder="Example: Macau intangible heritage exhibition"
          maxLength={500}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-slate-700">
          Style
          <select
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900"
          >
            <option value="white-box">White box</option>
            <option value="warm-museum">Warm museum</option>
            <option value="tech-showroom">Tech showroom</option>
            <option value="history-gallery">History gallery</option>
            <option value="immersive">Immersive</option>
          </select>
        </label>
        <label className="block text-[11px] text-slate-700">
          Exhibits
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
        Audience
        <input
          value={audience}
          onChange={(event) => setAudience(event.target.value)}
          className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
          placeholder="Example: students, families, business visitors"
          maxLength={120}
        />
      </label>

      <label className="block text-[11px] text-slate-700">
        Language
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as "zh-TW" | "zh-CN" | "en")}
          className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900"
        >
          <option value="zh-TW">Traditional Chinese</option>
          <option value="zh-CN">Simplified Chinese</option>
          <option value="en">English</option>
        </select>
      </label>

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
        {isGenerating ? "Generating..." : "Generate curator plan"}
      </button>

      {preview && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-slate-900">
          <div>
            <p className="text-[11px] font-semibold text-emerald-700">Preview</p>
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

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              Apply to scene
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
