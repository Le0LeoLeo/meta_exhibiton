import { ExhibitItem } from "../../types";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  selectedItem: ExhibitItem;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
};

export function PositionInspector({ selectedItem, updateItem }: Props) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-white/25 bg-white/14 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
      <p className="mb-2 text-xs font-semibold text-gray-700">{t('editorPositionTuning')}</p>
      <div className="grid grid-cols-3 gap-2">
        {([0, 1, 2] as const).map((idx) => (
          <div key={idx}>
            <label className="mb-1 block text-xs font-medium text-gray-700">{[t('editorAxisX'), t('editorAxisY'), t('editorAxisZ')][idx]}</label>
            <input
              type="number"
              aria-label={[t('editorAxisX'), t('editorAxisY'), t('editorAxisZ')][idx]}
              step="0.01"
              value={selectedItem.position[idx]}
              onChange={(e) => {
                const next = [...selectedItem.position] as [number, number, number];
                next[idx] = Number(e.target.value) || 0;
                updateItem(selectedItem.id, { position: next });
              }}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
