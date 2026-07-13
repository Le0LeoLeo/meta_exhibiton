import { Trash2 } from "lucide-react";
import { ExhibitItem } from "../../types";
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
  setAllLightStripsIntensity: (intensity: number) => void;
  isTtsGenerating: boolean;
  isTtsSpeaking: boolean;
  ttsError: string | null;
  playGuideAudio: () => Promise<void>;
  stopGuideAudio: () => void;
  className?: string;
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
  setAllLightStripsIntensity,
  isTtsGenerating,
  isTtsSpeaking,
  ttsError,
  playGuideAudio,
  stopGuideAudio,
  className,
}: Props) {
  const { t } = useI18n();
  if (!canEditSelectedItem || !selectedItem) return null;

  const genericColorType = selectedItem.type in genericColorItems ? (selectedItem.type as GenericColorItemType) : null;

  return (
    <div className={`absolute bottom-3 left-3 right-3 top-[23rem] overflow-y-auto rounded-[1.5rem] p-3 pointer-events-auto sm:left-auto sm:right-0 sm:top-[7.25rem] sm:bottom-4 sm:w-[20rem] sm:rounded-l-[1.8rem] sm:rounded-r-none sm:p-4 lg:w-[21rem] xl:w-[22rem] ${glassPanelClass} text-white ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <div>
          <p className={`${sectionTitleClass} text-white/60`}>Inspector</p>
          <h3 className="text-lg font-bold text-white">{t('editorInspectorTitle')}</h3>
          <p className="mt-1 text-xs text-white/70">{t('editorInspectorCurrent')}：{selectedItemTypeLabel}</p>
        </div>
        <button onClick={() => removeItem(selectedItem.id)} className="rounded-2xl border border-white/15 bg-white/8 p-2 text-white transition-colors hover:bg-white/14" title={t('editorInspectorDelete')}>
          <Trash2 className="h-5 w-5" />
        </button>
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
          <div className="rounded-2xl border border-amber-200/70 bg-amber-300/15 px-3 py-2 text-xs text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md">
            {t('editorLockedPartitionNotice')}
          </div>
        )}

        <PositionInspector selectedItem={selectedItem} updateItem={updateItem} />
      </div>
    </div>
  );
}
