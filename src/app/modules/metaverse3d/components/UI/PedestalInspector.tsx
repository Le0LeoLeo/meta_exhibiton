import { ExhibitItem } from "../../types";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  selectedItem: ExhibitItem;
  glassButtonClass: string;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
};

export function PedestalInspector({ selectedItem, glassButtonClass, updateItem }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">{t('editorModelUrl')}</label>
        <input
          type="text"
          value={selectedItem.content}
          onChange={(e) => updateItem(selectedItem.id, { content: e.target.value, fileName: undefined, fileMimeType: undefined })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500"
          placeholder="/models/model.glb 或 https://.../model.glb"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">{t('editorUploadModel')}</label>
        <input
          type="file"
          accept=".glb,.gltf,.stl,model/gltf-binary,model/gltf+json,model/stl,application/sla"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const lowerName = file.name.toLowerCase();
            const isSupported = lowerName.endsWith(".glb") || lowerName.endsWith(".gltf") || lowerName.endsWith(".stl");
            if (!isSupported) {
              window.alert(t('editorModelUnsupported'));
              e.currentTarget.value = "";
              return;
            }
            updateItem(selectedItem.id, {
              content: URL.createObjectURL(file),
              fileName: file.name,
              fileMimeType: file.type || (lowerName.endsWith(".gltf") ? "model/gltf+json" : lowerName.endsWith(".stl") ? "model/stl" : "model/gltf-binary"),
            });
            e.currentTarget.value = "";
          }}
        />
        {selectedItem.fileName && <p className="mt-1 text-xs text-gray-600">{t('editorCurrentModel')}：{selectedItem.fileName}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([0, 1, 2] as const).map((idx) => (
          <div key={idx}>
            <label className="mb-1 block text-xs font-medium text-gray-700">{t('editorModelOffset')} {"XYZ"[idx]}</label>
            <input
              type="number"
              step="0.01"
              value={selectedItem.modelOffset?.[idx] ?? 0}
              onChange={(e) => {
                const next = [...(selectedItem.modelOffset ?? [0, 0, 0])] as [number, number, number];
                next[idx] = Number(e.target.value) || 0;
                updateItem(selectedItem.id, { modelOffset: next });
              }}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </div>
        ))}
      </div>

      <button onClick={() => updateItem(selectedItem.id, { modelOffset: [0, 0, 0] })} className={`w-full rounded-xl py-2 text-sm transition-colors ${glassButtonClass}`}>
        {t('editorResetModelOffset')}
      </button>
    </div>
  );
}
