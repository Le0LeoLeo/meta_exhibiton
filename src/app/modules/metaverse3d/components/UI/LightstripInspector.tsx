import { ExhibitItem } from "../../types";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  selectedItem: ExhibitItem;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
  setAllLightStripsIntensity: (intensity: number) => void;
};

export function LightstripInspector({ selectedItem, updateItem, setAllLightStripsIntensity }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">{t('liColor')}</label>
        <input type="color" value={selectedItem.content || "#ffe08a"} onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })} className="h-9 w-full rounded-md border border-gray-300" />
      </div>
      <div>
        <div className="mb-1 flex justify-between">
          <label className="text-xs font-medium text-gray-700">{t('liIntensity')}</label>
          <span className="text-xs text-gray-500">{(selectedItem.lightIntensity ?? 0.5).toFixed(2)}</span>
        </div>
        <input type="range" min="0.1" max="1.2" step="0.05" value={selectedItem.lightIntensity ?? 0.5} onChange={(e) => updateItem(selectedItem.id, { lightIntensity: Number(e.target.value) })} className="w-full accent-amber-500" />
      </div>
      <button onClick={() => setAllLightStripsIntensity(selectedItem.lightIntensity ?? 0.5)} className="w-full rounded-xl border border-amber-200/70 bg-amber-400/18 px-2 py-1.5 text-xs font-medium text-amber-950 shadow-[0_6px_18px_rgba(245,158,11,0.12)] backdrop-blur-md transition-colors hover:bg-amber-400/26">{t('liSyncAll')}</button>
      <p className="text-xs text-gray-600">{t('liHint')}</p>
    </div>
  );
}
