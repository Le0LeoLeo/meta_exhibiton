import { ChevronLeft, Eye, Grid2X2, Users, SlidersHorizontal, Plane, Undo2, Redo2, Copy, Trash2, X, AlignHorizontalJustifyCenter } from 'lucide-react';
import { useI18n } from '../../../../components/I18nProvider';

export type EditorTopBarProps = {
  topBarRef: React.RefObject<HTMLDivElement>;
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
  isMoreOpen?: boolean;
  isNetworkOpen?: boolean;
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
  isMoreOpen = false,
  isNetworkOpen = false,
}: EditorTopBarProps) {
  const { t } = useI18n();

  return (
    <div ref={topBarRef} className={`editor-topbar absolute inset-x-0 top-0 z-30 ${glassPanelClass} px-4 py-3 pointer-events-auto`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onBack} className={topBarButtonClass + ' ' + glassButtonClass}>
            <ChevronLeft className="mr-1 size-4" /> {t('editorBack')}
          </button>
          <button onClick={onViewMode} className={topBarButtonPrimaryClass + ' bg-indigo-600'}>
            <Eye className="mr-1 size-4" /> {t('editorViewMode')}
          </button>
          <button onClick={onFloorPlanMode} className={topBarButtonClass + ' ' + glassButtonClass}>
            <Plane className="mr-1 size-4" /> {t('editorFloorPlanMode')}
          </button>
        </div>

        <div className="editor-status flex flex-wrap items-center gap-2 text-xs text-white/80">
          <span className="rounded-full border border-indigo-300/30 bg-indigo-500/20 px-2 py-1 font-semibold">{t('uxEditingMode')}</span>
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{t('editorItemsCount')} {itemsCount}</span>
          {multiplayerEnabled && <span className="inline-flex items-center gap-1.5 text-slate-300"><Users className="size-3.5" />{multiplayerConnected ? t('editorConnected') : t('editorConnecting')} · {t('editorCollaborators')} {multiplayerRemoteCount}</span>}
          {hasSelection && <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{t('editorSelected')} {selectedItemsCount}</span>}
          {selectedItemLabel && <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1">{selectedItemLabel}</span>}
          {sessionStatus}
        </div>
        <p className="w-full text-xs leading-relaxed text-white/80">{t(hasSelection ? 'uxSelectionHint' : 'uxEditorStartHint')}</p>

        <div className="editor-commands flex w-full flex-wrap items-center gap-2 border-t border-white/10 pt-2">
          <button onClick={onUndo} title={`${t('editorUndo')} (Ctrl/⌘ Z) · ${undoCount}`} className={topBarButtonClass + ' ' + glassButtonClass} disabled={undoCount === 0}><Undo2 className="mr-1 size-4" />{t('editorUndo')}</button>
          <button onClick={onRedo} title={`${t('editorRedo')} (Ctrl/⌘ Shift Z) · ${redoCount}`} className={topBarButtonClass + ' ' + glassButtonClass} disabled={redoCount === 0}><Redo2 className="mr-1 size-4" />{t('editorRedo')}</button>
          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
          <button onClick={onSnapSelectionToGrid} className={topBarButtonClass + ' ' + glassButtonClass} disabled={!hasSelection}>
            <Grid2X2 className="mr-1 size-4" /> {t('editorSnapToGrid')}
          </button>
          <details className="editor-align-menu relative" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
            <summary className={topBarButtonClass + ' cursor-pointer gap-1 ' + glassButtonClass}><AlignHorizontalJustifyCenter className="size-4" />{t('editorAlignX')} / {t('editorAlignZ')}</summary>
            <div className={`absolute left-0 top-full z-50 mt-2 grid w-60 grid-cols-2 gap-2 rounded-xl p-3 ${glassPanelClass}`}>
              <button onClick={onAlignSelectionX} className={topBarButtonClass + ' ' + glassButtonClass} disabled={selectedItemsCount < 2}>{t('editorAlignX')}</button>
              <button onClick={onAlignSelectionZ} className={topBarButtonClass + ' ' + glassButtonClass} disabled={selectedItemsCount < 2}>{t('editorAlignZ')}</button>
              <button onClick={onDistributeSelectionX} className={topBarButtonClass + ' ' + glassButtonClass} disabled={selectedItemsCount < 3}>{t('editorDistributeX')}</button>
              <button onClick={onDistributeSelectionZ} className={topBarButtonClass + ' ' + glassButtonClass} disabled={selectedItemsCount < 3}>{t('editorDistributeZ')}</button>
            </div>
          </details>
          <button onClick={onDuplicateSelection} className={topBarButtonClass + ' ' + glassButtonClass} disabled={!hasSelection}><Copy className="mr-1 size-4" />{t('editorDuplicate')}</button>
          <button onClick={onRemoveSelection} className={topBarButtonClass + ' editor-delete ' + glassButtonClass} disabled={!hasSelection}><Trash2 className="mr-1 size-4" />{t('editorDelete')}</button>
          <button onClick={onClearSelection} title={t('editorClearSelection')} aria-label={t('editorClearSelection')} className={topBarButtonClass + ' ' + glassButtonClass} disabled={!hasSelection}><X className="size-4" /></button>
          <div className="ml-auto flex gap-2">
          <button onClick={onToggleNetwork} aria-expanded={isNetworkOpen} aria-controls="editor-network-panel" className={topBarButtonClass + ' ' + glassButtonClass}>
            <Users className="mr-1 size-4" /> {t('editorNetwork')}
          </button>
          <button onClick={onToggleMore} aria-expanded={isMoreOpen} aria-controls="editor-more-panel" className={topBarButtonClass + ' ' + glassButtonClass}>
            <SlidersHorizontal className="mr-1 size-4" /> {t('editorMore')}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
