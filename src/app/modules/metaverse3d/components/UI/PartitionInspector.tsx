import { Lock, Unlock } from "lucide-react";
import { ExhibitItem } from "../../types";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  selectedItem: ExhibitItem;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
};

const scaleFields = [
  { labelKey: 'editorPartitionLength', min: 0.5, max: 30, step: 0.1, idx: 0 },
  { labelKey: 'editorPartitionHeight', min: 1, max: 12, step: 0.1, idx: 1 },
  { labelKey: 'editorPartitionDepth', min: 0.05, max: 2, step: 0.05, idx: 2 },
] as const;

export function PartitionInspector({ selectedItem, updateItem }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <button
        onClick={() => updateItem(selectedItem.id, { isLocked: !selectedItem.isLocked })}
        aria-pressed={Boolean(selectedItem.isLocked)}
        className={`w-full inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${selectedItem.isLocked ? "border-amber-300/50 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20" : "border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700"}`}
      >
        {selectedItem.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        {selectedItem.isLocked ? t('editorPartitionLocked') : t('editorPartitionUnlocked')}
      </button>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">{t('editorPartitionColor')}</label>
        <input type="color" value={selectedItem.content || "#f3f4f6"} disabled={selectedItem.isLocked} onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })} className="h-9 w-full rounded-md border border-gray-300 disabled:cursor-not-allowed disabled:opacity-50" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {scaleFields.map((field) => (
          <div key={field.labelKey}>
            <label className="mb-1 block text-xs font-medium text-gray-700">{t(field.labelKey)}</label>
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={selectedItem.scale[field.idx]}
              disabled={selectedItem.isLocked}
              onChange={(e) => {
                if (selectedItem.isLocked) return;
                const value = Math.max(field.min, Math.min(field.max, Number(e.target.value) || field.min));
                const next = [...selectedItem.scale] as [number, number, number];
                next[field.idx] = value;
                updateItem(selectedItem.id, { scale: next });
              }}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">旋轉 Y（度）</label>
        <input
          type="number"
          min="-180"
          max="180"
          step="1"
          value={Math.round((selectedItem.rotation[1] * 180) / Math.PI)}
          disabled={selectedItem.isLocked}
          onChange={(e) => {
            if (selectedItem.isLocked) return;
            const deg = Math.max(-180, Math.min(180, Number(e.target.value) || 0));
            updateItem(selectedItem.id, { rotation: [0, (deg * Math.PI) / 180, 0] });
          }}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <p className="text-xs text-gray-600">{t('editorPartitionNotice')}</p>
    </div>
  );
}
