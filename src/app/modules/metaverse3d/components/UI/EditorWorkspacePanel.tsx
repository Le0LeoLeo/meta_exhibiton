import { ReactNode, RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  workspaceRef?: RefObject<HTMLDivElement>;
  glassPanelClass: string;
  glassButtonClass: string;
  glassInputClass: string;
  sectionCardClass: string;
  isModelLibraryOpen: boolean;
  isSettingsPanelCollapsed: boolean;
  setIsSettingsPanelCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsModelLibraryOpen: (value: boolean) => void;
  className?: string;
  children: ReactNode;
};

export function EditorWorkspacePanel({ workspaceRef, glassPanelClass, glassButtonClass, isModelLibraryOpen, isSettingsPanelCollapsed, setIsSettingsPanelCollapsed, setIsModelLibraryOpen, className, children, }: Props) {
  const { t } = useI18n();
  return (
    <div
      ref={workspaceRef}
      data-collapsed={isSettingsPanelCollapsed}
      style={{ maxHeight: "calc(100dvh - var(--top-bar-height, 6rem) - 1rem)", top: "calc(var(--top-bar-height, 6rem) + 0.75rem)" }}
      className={`editor-workspace absolute pointer-events-auto z-20 overflow-y-auto text-white ${glassPanelClass} ${isModelLibraryOpen ? "invisible" : ""} ${className ?? ""}`}
    >
      <div className={`${isSettingsPanelCollapsed ? "" : "editor-panel-heading mb-4"} flex items-center justify-between gap-2`}>
        {!isSettingsPanelCollapsed ? (
          <div>
            <h3 className="text-sm font-semibold text-white">{t('editorWorkspaceTitle')}</h3>
            <p className="mt-0.5 text-[11px] text-white/70">{t('editorWorkspaceDesc')}</p>
          </div>
        ) : null}
        <button onClick={() => { setIsSettingsPanelCollapsed((prev) => !prev); setIsModelLibraryOpen(false); }} aria-expanded={!isSettingsPanelCollapsed} aria-label={isSettingsPanelCollapsed ? t('editorExpandSettings') : t('editorCollapseSettings')} title={isSettingsPanelCollapsed ? t('editorExpandSettings') : t('editorCollapseSettings')} className={`flex min-w-9 shrink-0 items-center justify-center rounded-lg text-sm text-white/90 ${glassButtonClass}`}>
          {isSettingsPanelCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
      {!isSettingsPanelCollapsed && children}
    </div>
  );
}
