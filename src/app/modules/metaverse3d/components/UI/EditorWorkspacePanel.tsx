import { ReactNode, RefObject } from "react";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  workspaceRef?: RefObject<HTMLDivElement | null>;
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
      style={{ maxHeight: "calc(100dvh - var(--top-bar-height, 6rem) - 1rem)", top: "calc(var(--top-bar-height, 6rem) + 0.75rem)" }}
      className={`absolute left-[5.2rem] rounded-[1.5rem] pointer-events-auto transition-all duration-200 z-20 sm:left-24 sm:rounded-[1.75rem] overflow-y-auto text-white ${glassPanelClass} ${isModelLibraryOpen && !isSettingsPanelCollapsed ? "sm:left-[18.5rem]" : ""} ${className ?? ""} ${isSettingsPanelCollapsed ? "w-12 overflow-hidden p-2 sm:w-14 sm:p-2.5" : "w-[17.5rem] p-3 sm:w-[20rem] sm:p-4 lg:w-[22rem] xl:w-[23rem]"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        {!isSettingsPanelCollapsed ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/65">Workspace</p>
            <h3 className="text-sm font-semibold text-white">{t('editorWorkspaceTitle')}</h3>
            <p className="mt-0.5 text-[11px] text-white/70">{t('editorWorkspaceDesc')}</p>
          </div>
        ) : <div className="h-6" />}
        <button onClick={() => { setIsSettingsPanelCollapsed((prev) => !prev); setIsModelLibraryOpen(false); }} title={isSettingsPanelCollapsed ? t('editorExpandSettings') : t('editorCollapseSettings')} className={`flex h-7 w-7 items-center justify-center rounded-xl text-sm text-white/90 transition-colors ${glassButtonClass}`}>
          {isSettingsPanelCollapsed ? "▶" : "◀"}
        </button>
      </div>
      {!isSettingsPanelCollapsed && children}
    </div>
  );
}
