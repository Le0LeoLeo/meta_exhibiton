import { Trash2, X } from "lucide-react";
import { ExhibitItem, PaintingFrameAppearance } from "../../types";
import { GenericColorInspector } from "./GenericColorInspector";
import { LightstripInspector } from "./LightstripInspector";
import { PaintingInspector } from "./PaintingInspector";
import { PartitionInspector } from "./PartitionInspector";
import { PedestalInspector } from "./PedestalInspector";
import { PositionInspector } from "./PositionInspector";
import { TextInspector } from "./TextInspector";
import { genericColorItems, GenericColorItemType } from "./inspectorShared";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  canEditSelectedItem: boolean;
  selectedItem: ExhibitItem | undefined;
  selectedItemTypeLabel: string | null;
  selectedIsLockedPartition: boolean;
  glassPanelClass: string;
  glassButtonClass: string;
  glassInputClass: string;
  sectionTitleClass: string;
  keepFrameAspectRatio: boolean;
  setKeepFrameAspectRatio: (value: boolean) => void;
  maxPaintingUploadSizeMB: number;
  selectedItemIsVideo: boolean;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
  removeItem: (id: string) => void;
  setAllPaintingFrameSize: (width: number, height: number) => void;
  setAllPaintingFrameAppearance: (appearance: PaintingFrameAppearance) => void;
  setAllLightStripsIntensity: (intensity: number) => void;
  isTtsGenerating: boolean;
  isTtsSpeaking: boolean;
  ttsError: string | null;
  playGuideAudio: () => Promise<void>;
  stopGuideAudio: () => void;
  className?: string;
  onClose?: () => void;
};

export function EditorInspectorPanel({
  canEditSelectedItem,
  selectedItem,
  selectedItemTypeLabel,
  selectedIsLockedPartition,
  glassPanelClass,
  glassButtonClass,
  glassInputClass,
  sectionTitleClass,
  keepFrameAspectRatio,
  setKeepFrameAspectRatio,
  maxPaintingUploadSizeMB,
  selectedItemIsVideo,
  updateItem,
  removeItem,
  setAllPaintingFrameSize,
  setAllPaintingFrameAppearance,
  setAllLightStripsIntensity,
  isTtsGenerating,
  isTtsSpeaking,
  ttsError,
  playGuideAudio,
  stopGuideAudio,
  className,
  onClose,
}: Props) {
  const { t } = useI18n();
  if (!canEditSelectedItem || !selectedItem) return null;

  const genericColorType = selectedItem.type in genericColorItems ? (selectedItem.type as GenericColorItemType) : null;

  return (
    <div className={`editor-inspector absolute overflow-y-auto pointer-events-auto ${glassPanelClass} text-white ${className ?? ""}`}>
      <div className="editor-panel-heading mb-4 flex items-start justify-between gap-3">
        <div>
          <p className={sectionTitleClass}>{selectedItemTypeLabel}</p>
          <h3 className="text-lg font-bold text-white">{t('editorInspectorTitle')}</h3>
          <p className="mt-1 text-xs text-white/70">{t('editorInspectorCurrent')}：{selectedItemTypeLabel}</p>
        </div>
        <div className="flex gap-1">
        <button onClick={() => removeItem(selectedItem.id)} className="editor-delete rounded-lg border border-white/15 p-2 text-white" title={t('editorInspectorDelete')} aria-label={t('editorInspectorDelete')}>
          <Trash2 className="h-5 w-5" />
        </button>
        {onClose && <button onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label={t('close')}><X className="size-5" /></button>}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-white/15 bg-white/8 px-3 py-2 text-[11px] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-white">{t('editorInspectorAdviceTitle')}</span>
          <span>{t('editorInspectorAdviceDesc')}</span>
        </div>
      </div>

      <div className="space-y-4">
        {selectedItem.type === "painting" && (
          <PaintingInspector
            selectedItem={selectedItem}
            glassInputClass={glassInputClass}
            glassButtonClass={glassButtonClass}
            keepFrameAspectRatio={keepFrameAspectRatio}
            setKeepFrameAspectRatio={setKeepFrameAspectRatio}
            maxPaintingUploadSizeMB={maxPaintingUploadSizeMB}
            selectedItemIsVideo={selectedItemIsVideo}
            updateItem={updateItem}
            setAllPaintingFrameSize={setAllPaintingFrameSize}
            setAllPaintingFrameAppearance={setAllPaintingFrameAppearance}
            isTtsGenerating={isTtsGenerating}
            isTtsSpeaking={isTtsSpeaking}
            ttsError={ttsError}
            playGuideAudio={playGuideAudio}
            stopGuideAudio={stopGuideAudio}
          />
        )}

        {selectedItem.type === "pedestal" && (
          <PedestalInspector selectedItem={selectedItem} glassButtonClass={glassButtonClass} updateItem={updateItem} />
        )}

        {selectedItem.type === "text" && (
          <TextInspector selectedItem={selectedItem} glassInputClass={glassInputClass} updateItem={updateItem} />
        )}

        {selectedItem.type === "partition" && (
          <PartitionInspector selectedItem={selectedItem} updateItem={updateItem} />
        )}

        {selectedItem.type === "lightstrip" && (
          <LightstripInspector selectedItem={selectedItem} updateItem={updateItem} setAllLightStripsIntensity={setAllLightStripsIntensity} />
        )}

        {genericColorType && (
          <GenericColorInspector selectedItem={selectedItem} itemType={genericColorType} updateItem={updateItem} />
        )}

        {selectedIsLockedPartition && (
          <div className="rounded-xl border border-amber-200/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
            {t('editorLockedPartitionNotice')}
          </div>
        )}

        <PositionInspector selectedItem={selectedItem} updateItem={updateItem} />
      </div>
    </div>
  );
}
