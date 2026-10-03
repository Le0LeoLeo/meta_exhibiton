import { useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { WallMaterialPreset, RoomSize } from "../../types";
import { editorThemePresetLabelKeys, floorTexturePresets, wallTexturePresets } from "./editorConstants";
import type { EditorThemePreset } from "../../store/useMetaverseStudioStore";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  sectionCardClass: string;
  glassInputClass: string;
  roomSize: RoomSize;
  setRoomSize: (updates: Partial<RoomSize>) => void;
  environmentBrightness: number;
  floorColor: string;
  floorTextureUrl: string;
  floorTextureTiling: number;
  floorRoughness: number;
  floorMetalness: number;
  wallColor: string;
  wallMaterialPreset: WallMaterialPreset;
  wallTextureUrl: string;
  wallTextureTiling: number;
  wallRoughness: number;
  wallMetalness: number;
  wallBumpScale: number;
  wallEnvIntensity: number;
  wallOpacity: number;
  wallTransmission: number;
  wallIor: number;
  applyWallSettings: (updates: Record<string, unknown>) => void;
  applySciFiTheme: () => void;
  applyNightLighting: () => void;
  applyBalancedLighting: () => void;
  editorThemePresets: EditorThemePreset[];
  onApplyThemePreset: (presetId: string) => void;
  onAddThemePreset: (preset: EditorThemePreset) => void;
  onRemoveThemePreset: (presetId: string) => void;
  onAddCustomWallTexturePreset: (preset: { label: string; value: string }) => void;
  onRemoveCustomWallTexturePreset: (value: string) => void;
  customWallTexturePresets: Array<{ label: string; value: string }>;
};

export function WorkspaceRoomSettingsPanel({
  sectionCardClass,
  glassInputClass,
  roomSize,
  setRoomSize,
  environmentBrightness,
  floorColor,
  floorTextureUrl,
  floorTextureTiling,
  floorRoughness,
  floorMetalness,
  wallColor,
  wallMaterialPreset,
  wallTextureUrl,
  wallTextureTiling,
  wallRoughness,
  wallMetalness,
  wallBumpScale,
  wallEnvIntensity,
  wallOpacity,
  wallTransmission,
  wallIor,
  applyWallSettings,
  applySciFiTheme,
  applyNightLighting,
  applyBalancedLighting,
  editorThemePresets,
  onApplyThemePreset,
  onAddThemePreset,
  onRemoveThemePreset,
  onAddCustomWallTexturePreset,
  onRemoveCustomWallTexturePreset,
  customWallTexturePresets,
}: Props) {
  const { t } = useI18n();
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState(editorThemePresets[0]?.id ?? "");
  const [customTexturePreview, setCustomTexturePreview] = useState<string | null>(null);

  const activePreset = useMemo(() => editorThemePresets.find((preset) => preset.id === selectedPresetId) ?? null, [editorThemePresets, selectedPresetId]);
  const isCustomWallTexture = /^data:|^blob:/.test(wallTextureUrl);
  const previewTexture = customTexturePreview || wallTextureUrl;

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    onApplyThemePreset(presetId);
  };

  return (
    <>
      <details className={`mb-3 ${sectionCardClass} text-white`}>
        <summary className="cursor-pointer text-xs font-semibold text-white">{t('editorThemeSectionTitle')}</summary>
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={applySciFiTheme} className="rounded-md border border-white/12 bg-white/8 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/12">{t('editorThemeScifi')}</button>
            <button onClick={applyNightLighting} className="rounded-md border border-white/12 bg-white/8 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/12">{t('editorThemeNight')}</button>
            <button onClick={applyBalancedLighting} className="rounded-md border border-white/12 bg-white/8 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/12">{t('editorThemeBalanced')}</button>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">{t('editorCustomThemeLibrary')}</p>
            <div className="mt-2 flex gap-2">
              <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder={t('editorCustomThemePlaceholder')} className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 text-xs ${glassInputClass}`} />
              <button onClick={() => {
                const name = presetName.trim();
                if (!name) return;
                const id = `custom-${Date.now()}`;
                onAddThemePreset({ id, name, settings: { ...roomSize } });
                setSelectedPresetId(id);
                setPresetName("");
              }} className="rounded-xl border border-white/12 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500/30">{t('editorSaveCurrent')}</button>
            </div>
            <div className="mt-2 flex gap-2">
              <select value={selectedPresetId} onChange={(e) => handleSelectPreset(e.target.value)} className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 text-xs ${glassInputClass}`}>
                {editorThemePresets.map((theme) => <option key={theme.id} value={theme.id}>{t(editorThemePresetLabelKeys[theme.id] ?? theme.name)}</option>)}
              </select>
              <button onClick={() => activePreset && handleSelectPreset(activePreset.id)} className="rounded-xl border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/16">{t('editorApply')}</button>
              <button onClick={() => activePreset && onRemoveThemePreset(activePreset.id)} disabled={!activePreset?.id.startsWith("custom-") } className="rounded-xl border border-white/12 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40">{t('editorDelete')}</button>
            </div>
          </div>
        </div>
      </details>

      <details className={`${sectionCardClass} text-white`}>
        <summary className="cursor-pointer text-xs font-semibold text-white">{t('editorSpaceAndMaterials')}</summary>
        <div className="mt-2 space-y-3">
          <Slider label={t('editorRoomWidth')} value={`${roomSize.width}m`} min={10} max={50} current={roomSize.width} onChange={(value) => setRoomSize({ width: value })} />
          <Slider label={t('editorRoomLength')} value={`${roomSize.length}m`} min={10} max={50} current={roomSize.length} onChange={(value) => setRoomSize({ length: value })} />
          <Slider label={t('editorRoomHeight')} value={`${roomSize.height}m`} min={3} max={15} current={roomSize.height} onChange={(value) => setRoomSize({ height: value })} />
          <Slider label={t('editorWallThickness')} value={`${roomSize.wallThickness}m`} min={0.1} max={2} step={0.1} current={roomSize.wallThickness} onChange={(value) => setRoomSize({ wallThickness: value })} />
          <Slider label={t('editorEnvironmentBrightness')} value={`${environmentBrightness.toFixed(2)}x`} min={0.2} max={2.5} step={0.05} current={environmentBrightness} onChange={(value) => setRoomSize({ environmentBrightness: value })} />

          <details className="pt-1 text-white" open>
            <summary className="cursor-pointer text-xs font-semibold text-white">{t('editorFloorMaterials')}</summary>
            <div className="mt-2 space-y-3">
              <div>
                <div className="mb-1 flex justify-between"><label className="text-xs font-medium text-white/85">{t('editorFloorColor')}</label><span className="text-xs text-white/60">{floorColor}</span></div>
                <input type="color" value={floorColor} onChange={(e) => setRoomSize({ floorColor: e.target.value })} className={`h-9 w-full rounded-xl ${glassInputClass}`} />
              </div>
              <div>
                <div className="mb-1 flex justify-between"><label className="text-xs font-medium text-white/85">{t('editorFloorTexture')}</label></div>
                <select value={floorTextureUrl} onChange={(e) => setRoomSize({ floorTextureUrl: e.target.value })} className={`w-full rounded-xl px-2 py-1.5 text-sm ${glassInputClass}`}>
                  {floorTexturePresets.map((preset) => <option key={preset.value} value={preset.value}>{t(preset.labelKey)}</option>)}
                </select>
              </div>
              <Slider label={t('editorFloorTextureDensity')} value={`${floorTextureTiling.toFixed(1)}x`} min={0.5} max={8} step={0.5} current={floorTextureTiling} onChange={(value) => setRoomSize({ floorTextureTiling: value })} />
              <Slider label={t('editorFloorRoughness')} value={floorRoughness.toFixed(2)} min={0} max={1} step={0.01} current={floorRoughness} onChange={(value) => setRoomSize({ floorRoughness: value })} />
              <Slider label={t('editorFloorMetalness')} value={floorMetalness.toFixed(2)} min={0} max={1} step={0.01} current={floorMetalness} onChange={(value) => setRoomSize({ floorMetalness: value })} />
            </div>
          </details>

          <div>
            <div className="mb-1 flex justify-between"><label className="text-xs font-medium text-white/85">{t('editorWallColor')}</label><span className="text-xs text-white/60">{wallColor}</span></div>
            <input type="color" value={wallColor} onChange={(e) => applyWallSettings({ wallColor: e.target.value })} className="h-9 w-full rounded-md border border-white/12 bg-white/8" />
          </div>

          <div>
            <div className="mb-1 flex justify-between"><label className="text-xs font-medium text-white/85">{t('editorWallMaterial')}</label></div>
            <select
              value={wallMaterialPreset}
              onChange={(e) => {
                const material = e.target.value as WallMaterialPreset;
                const textureByMaterial: Record<WallMaterialPreset, string> = {
                  paint: "/textures/wall-paint.svg",
                  concrete: "/textures/wall-concrete.svg",
                  wood: "/textures/wall-wood.svg",
                  metal: "/textures/wall-metal.svg",
                  glass: "/textures/wall-paint.svg",
                };
                const materialDefaults: Record<WallMaterialPreset, Record<string, number>> = {
                  paint: { wallRoughness: 0.62, wallMetalness: 0.02, wallBumpScale: 0.05, wallEnvIntensity: 0.35, wallOpacity: 1, wallTransmission: 0, wallIor: 1.45 },
                  concrete: { wallRoughness: 0.9, wallMetalness: 0.04, wallBumpScale: 0.12, wallEnvIntensity: 0.25, wallOpacity: 1, wallTransmission: 0, wallIor: 1.45 },
                  wood: { wallRoughness: 0.74, wallMetalness: 0.07, wallBumpScale: 0.09, wallEnvIntensity: 0.3, wallOpacity: 1, wallTransmission: 0, wallIor: 1.45 },
                  metal: { wallRoughness: 0.24, wallMetalness: 0.86, wallBumpScale: 0.03, wallEnvIntensity: 0.8, wallOpacity: 1, wallTransmission: 0, wallIor: 1.45 },
                  glass: { wallRoughness: 0.08, wallMetalness: 0, wallBumpScale: 0, wallEnvIntensity: 1.1, wallOpacity: 0.45, wallTransmission: 0.92, wallIor: 1.5 },
                };
                applyWallSettings({ wallMaterialPreset: material, wallTextureUrl: textureByMaterial[material], ...materialDefaults[material] });
              }}
              className="w-full rounded-md border border-white/12 bg-white/8 px-2 py-1.5 text-sm text-white"
            >
              <option value="paint">{t('editorMaterialPaint')}</option>
              <option value="concrete">{t('editorMaterialConcrete')}</option>
              <option value="wood">{t('editorMaterialWood')}</option>
              <option value="metal">{t('editorMaterialMetal')}</option>
              <option value="glass">{t('editorMaterialGlass')}</option>
            </select>
          </div>

          <div>
            <div className="mb-1 flex justify-between"><label className="text-xs font-medium text-gray-700">{t('editorTextureStyle')}</label></div>
            <select value={wallTextureUrl} onChange={(e) => applyWallSettings({ wallTextureUrl: e.target.value, wallMaterialPreset: "paint" })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-black">
              {wallTexturePresets.map((preset) => <option key={preset.value} value={preset.value}>{t(preset.labelKey)}</option>)}
              {customWallTexturePresets.map((preset) => <option key={preset.value} value={preset.value}>{preset.label} ({t('editorPresetCustomSuffix')})</option>)}
            </select>
            <label className="mt-2 block text-xs font-medium text-gray-700">{t('editorUploadCustomWallTexture')}</label>
            <input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className={`mt-1 w-full rounded-xl px-2 py-1.5 text-sm ${glassInputClass} file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-2 file:py-1 file:text-white hover:file:bg-indigo-600`} onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const result = typeof reader.result === "string" ? reader.result : "";
                if (!result) return;
                const label = file.name.replace(/\.[^.]+$/, "") || t('editorCustomTexture');
                setCustomTexturePreview(result);
                onAddCustomWallTexturePreset({ label, value: result });
                applyWallSettings({
                  wallTextureUrl: result,
                  wallMaterialPreset: "paint",
                  wallColor: "#f8fafc",
                  wallRoughness: 0.52,
                  wallMetalness: 0.02,
                  wallBumpScale: 0.08,
                  wallEnvIntensity: 0.42,
                  wallOpacity: 1,
                  wallTransmission: 0,
                  wallIor: 1.45,
                });
              };
              reader.readAsDataURL(file);
              e.currentTarget.value = "";
            }} />
            <div className="mt-3 overflow-hidden rounded-xl border border-white/15 bg-white/6">
              <div className="flex items-center justify-between border-b border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                <span>{t('editorPreview')}</span>
                {isCustomWallTexture ? <span>{t('editorCustomTextureApplied')}</span> : <span>{t('editorCurrentStyle')}</span>}
              </div>
              <div className="grid grid-cols-[88px_1fr] gap-3 p-2">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-slate-900/60">
                  {previewTexture ? (
                    <img src={previewTexture} alt={t('editorWallTexturePreview')} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/40"><ImageOff className="size-5" /></div>
                  )}
                </div>
                <div className="space-y-1 text-[11px] leading-relaxed text-white/72">
                  <p>{t('editorUploadPreviewHint')}</p>
                  <p>{t('editorCustomTextureListHint')}</p>
                </div>
              </div>
              {customWallTexturePresets.length > 0 && (
                <div className="space-y-2 border-t border-white/10 p-2">
                  {customWallTexturePresets.map((preset) => (
                    <div key={preset.value} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/80">
                      <button type="button" className="truncate text-left hover:text-white" onClick={() => applyWallSettings({ wallTextureUrl: preset.value, wallMaterialPreset: "paint" })}>
                        {preset.label}
                      </button>
                      <button type="button" className="rounded-md border border-white/10 bg-rose-500/15 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-500/25" onClick={() => onRemoveCustomWallTexturePreset(preset.value)}>
                        {t('delete')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Slider label={t('editorTextureDensity')} value={`${wallTextureTiling.toFixed(1)}x`} min={0.5} max={8} step={0.5} current={wallTextureTiling} onChange={(value) => applyWallSettings({ wallTextureTiling: value })} />
          <Slider label={t('editorRoughness')} value={wallRoughness.toFixed(2)} min={0} max={1} step={0.01} current={wallRoughness} onChange={(value) => applyWallSettings({ wallRoughness: value })} />
          <Slider label={t('editorMetalness')} value={wallMetalness.toFixed(2)} min={0} max={1} step={0.01} current={wallMetalness} onChange={(value) => applyWallSettings({ wallMetalness: value })} />
          <Slider label={t('editorBumpScale')} value={wallBumpScale.toFixed(2)} min={0} max={0.3} step={0.01} current={wallBumpScale} onChange={(value) => applyWallSettings({ wallBumpScale: value })} />
          <Slider label={t('editorEnvReflection')} value={wallEnvIntensity.toFixed(2)} min={0} max={1.5} step={0.01} current={wallEnvIntensity} onChange={(value) => applyWallSettings({ wallEnvIntensity: value })} />
          <Slider label={t('editorOpacity')} value={wallOpacity.toFixed(2)} min={0.1} max={1} step={0.01} current={wallOpacity} onChange={(value) => applyWallSettings({ wallOpacity: value })} />
          <Slider label={t('editorTransmission')} value={wallTransmission.toFixed(2)} min={0} max={1} step={0.01} current={wallTransmission} onChange={(value) => applyWallSettings({ wallTransmission: value })} />
          <Slider label={t('editorIOR')} value={wallIor.toFixed(2)} min={1} max={2.5} step={0.01} current={wallIor} onChange={(value) => applyWallSettings({ wallIor: value })} />
        </div>
      </details>

      <details className="mt-4 text-white">
        <summary className="cursor-pointer text-xs font-semibold text-white">{t('editorTipsTitle')}</summary>
        <div className="mt-2 rounded-2xl border border-white/12 bg-white/8 p-3 text-xs leading-relaxed text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
          <p><span className="font-mono text-white">T / R / S</span>：{t('editorShortcutTransform')}</p>
          <p><span className="font-mono text-white">Delete / Backspace</span>：{t('editorShortcutDelete')}</p>
          <p><span className="font-mono text-white">Ctrl/Cmd + D</span>：{t('editorShortcutDuplicate')}</p>
          <p><span className="font-mono text-white">Ctrl/Cmd + Z</span>：{t('editorShortcutUndo')}</p>
          <p><span className="font-mono text-white">Ctrl/Cmd + Shift + Z</span>：{t('editorShortcutRedo')}</p>
          <p><span className="font-mono text-white">Ctrl/Cmd + F</span>：{t('editorShortcutFloorPlan')}</p>
          <p className="mt-2">• {t('editorTipMaterials')}</p>
          <p>• {t('editorTipTextureDensity')}</p>
          <p>• {t('editorTipPartition')}</p>
        </div>
      </details>
    </>
  );
}

type SliderProps = {
  label: string;
  value: string;
  min: number;
  max: number;
  current: number;
  step?: number;
  onChange: (value: number) => void;
};

function Slider({ label, value, min, max, current, step, onChange }: SliderProps) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <span className="text-xs text-gray-500">{value}</span>
      </div>
      <input type="range" aria-label={label} aria-valuetext={value} min={min} max={max} step={step} value={current} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-indigo-600" />
    </div>
  );
}
