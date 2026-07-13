import { ExhibitItem } from "../../types";
import { genericColorItems, GenericColorItemType } from "./inspectorShared";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  selectedItem: ExhibitItem;
  itemType: GenericColorItemType;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
};

export function GenericColorInspector({ selectedItem, itemType, updateItem }: Props) {
  const { t } = useI18n();
  const config = genericColorItems[itemType];

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">{t(config.labelKey)}</label>
        <input
          type="color"
          value={selectedItem.content || config.defaultColor}
          onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
          className="h-9 w-full rounded-md border border-gray-300"
        />
      </div>
      <p className="text-xs text-gray-600">{t(config.tipKey)}</p>
    </div>
  );
}
