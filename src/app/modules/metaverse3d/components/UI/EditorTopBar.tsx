import { ChevronLeft, Edit3, Grid2X2, Layers3, PanelRightOpen, Plane, Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '../../../../components/I18nProvider';

export type EditorTopBarProps = {
  topBarRef: React.RefObject<HTMLDivElement | null>;
  glassPanelClass: string;
  glassButtonClass: string;
  topBarButtonClass: string;
  topBarButtonPrimaryClass: string;
  selectedItemLabel: string | null;
  itemsCount: number;
  undoCount: number;
  redoCount: number;
  hasSelection: boolean;
  selectedItemsCount: number;
  multiplayerEnabled: boolean;
  multiplayerConnected: boolean;
  multiplayerRemoteCount: number;
  sessionStatus?: React.ReactNode;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onViewMode: () => void;
  onFloorPlanMode: () => void;
  onToggleMore: () => void;
  onToggleNetwork: () => void;
  onDuplicateSelection: () => void;
  onRemoveSelection: () => void;
  onClearSelection: () => void;
  onSnapSelectionToGrid: () => void;
  onAlignSelectionX: () => void;
  onAlignSelectionZ: () => void;
  onDistributeSelectionX: () => void;
  onDistributeSelectionZ: () => void;
};

export function EditorTopBar({
  topBarRef,
  glassPanelClass,
  glassButtonClass,
  topBarButtonClass,
  topBarButtonPrimaryClass,
  selectedItemLabel,
  itemsCount,
  undoCount,
  redoCount,
  hasSelection,
  selectedItemsCount,
  multiplayerEnabled,
  multiplayerConnected,
  multiplayerRemoteCount,
  sessionStatus,
  onBack,
  onUndo,
  onRedo,
  onViewMode,
  onFloorPlanMode,
  onToggleMore,
  onToggleNetwork,
  onDuplicateSelection,
  onRemoveSelection,
  onClearSelection,
  onSnapSelectionToGrid,
  onAlignSelectionX,
  onAlignSelectionZ,
  onDistributeSelectionX,
  onDistributeSelectionZ,
}: EditorTopBarProps) {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div ref={topBarRef} className={`absolute inset-x-0 top-0 z-30 ${glassPanelClass} border-b-0 px-3 py-2 pointer-events-auto`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onBack} className={topBarButtonClass + ' ' + glassButtonClass}>
            <ChevronLeft className="mr-1 size-4" /> {t('editorBack')}
          </button>
          <button onClick={onViewMode} className={topBarButtonPrimaryClass + ' bg-indigo-600'}>
            <Edit3 className="mr-1 size-4" /> {t('editorViewMode')}
          </button>
          <button onClick={onFloorPlanMode} className={topBarButtonClass + ' ' + glassButtonClass}>
            <Plane className="mr-1 size-4" /> {t('editorFloorPlanMode')}
          </button>
          <button onClick={() => navigate(`/virtual-gallery/upload${window.location.search}`)} className={topBarButtonClass + ' ' + 'border border-cyan-200 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30'}>
            <Upload className="mr-1 size-4" /> {t('editorQuickUpload')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{t('editorItemsCount')} {itemsCount}</span>
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{t('editorUndoCount')} {undoCount}</span>
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{t('editorRedoCount')} {redoCount}</span>
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{t('editorMultiplayer')} {multiplayerEnabled ? (multiplayerConnected ? t('editorConnected') : t('editorConnecting')) : t('editorDisabled')}</span>
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{t('editorCollaborators')} {multiplayerRemoteCount}</span>
          {hasSelection && <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{t('editorSelected')} {selectedItemsCount}</span>}
          {selectedItemLabel && <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{selectedItemLabel}</span>}
          {sessionStatus}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onUndo} className={topBarButtonClass + ' ' + glassButtonClass} disabled={undoCount === 0}>{t('editorUndo')}</button>
          <button onClick={onRedo} className={topBarButtonClass + ' ' + glassButtonClass} disabled={redoCount === 0}>{t('editorRedo')}</button>
          <button onClick={onSnapSelectionToGrid} className={topBarButtonClass + ' ' + glassButtonClass} disabled={!hasSelection}>
            <Grid2X2 className="mr-1 size-4" /> {t('editorSnapToGrid')}
          </button>
          <button onClick={onAlignSelectionX} className={topBarButtonClass + ' ' + glassButtonClass} disabled={selectedItemsCount < 2}>{t('editorAlignX')}</button>
          <button onClick={onAlignSelectionZ} className={topBarButtonClass + ' ' + glassButtonClass} disabled={selectedItemsCount < 2}>{t('editorAlignZ')}</button>
          <button onClick={onDistributeSelectionX} className={topBarButtonClass + ' ' + glassButtonClass} disabled={selectedItemsCount < 3}>{t('editorDistributeX')}</button>
          <button onClick={onDistributeSelectionZ} className={topBarButtonClass + ' ' + glassButtonClass} disabled={selectedItemsCount < 3}>{t('editorDistributeZ')}</button>
          <button onClick={onDuplicateSelection} className={topBarButtonClass + ' ' + glassButtonClass} disabled={!hasSelection}>{t('editorDuplicate')}</button>
          <button onClick={onRemoveSelection} className={topBarButtonClass + ' ' + glassButtonClass} disabled={!hasSelection}>{t('editorDelete')}</button>
          <button onClick={onClearSelection} className={topBarButtonClass + ' ' + glassButtonClass} disabled={!hasSelection}>{t('editorClearSelection')}</button>
          <button onClick={onToggleNetwork} className={topBarButtonClass + ' ' + glassButtonClass}>
            <Layers3 className="mr-1 size-4" /> {t('editorNetwork')}
          </button>
          <button onClick={onToggleMore} className={topBarButtonClass + ' ' + glassButtonClass}>
            <PanelRightOpen className="mr-1 size-4" /> {t('editorMore')}
          </button>
        </div>
      </div>
    </div>
  );
}
