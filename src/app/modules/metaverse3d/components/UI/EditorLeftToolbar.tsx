import { Package, X } from "lucide-react";
import { ExhibitItem } from "../../types";
import { itemToolButtons, modelLibraryButtons } from "./editorConstants";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  glassPanelClass: string;
  isModelLibraryOpen: boolean;
  setIsModelLibraryOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  handleAddItem: (type: ExhibitItem["type"], preset?: 'vehicle-platform') => void;
};

export function EditorLeftToolbar({
  glassPanelClass,
  isModelLibraryOpen,
  setIsModelLibraryOpen,
  handleAddItem,
}: Props) {
  const { t } = useI18n();
  return (
    <div className={`editor-toolrail absolute top-[calc(var(--top-bar-height,6rem)+0.75rem)] z-30 pointer-events-auto ${glassPanelClass}`}>
      <div className="mb-3 px-1 pt-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
        {t('editorAdd')}
      </div>

      <div className="editor-tools-scroll space-y-1.5">
        {itemToolButtons.map((tool) => {
          const Icon = tool.icon;
          const label = t(tool.labelKey);
          return (
            <button
              key={tool.preset ?? tool.type}
              onClick={() => tool.preset ? handleAddItem(tool.type, tool.preset) : handleAddItem(tool.type)}
              title={label}
              aria-label={label}
              className={`group flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/6 text-slate-200 hover:bg-white/12 hover:text-white ${tool.className}`}
            >
              <Icon className="h-5 w-5 opacity-85 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-[10px] leading-tight">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="my-3 h-px bg-white/10" />

      <button
        onClick={() => setIsModelLibraryOpen((prev) => !prev)}
        title={t('editorModelLibrary')}
        aria-label={t('editorModelLibrary')}
        aria-expanded={isModelLibraryOpen}
        aria-controls="editor-model-library"
        className={`flex h-12 w-full items-center justify-center rounded-2xl border transition-all duration-200 ${
          isModelLibraryOpen
            ? "border-indigo-300/70 bg-indigo-500/18 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.15),0_8px_24px_rgba(79,70,229,0.18)]"
            : "border-white/10 bg-white/6 text-white/85 hover:bg-white/12 hover:text-white"
        }`}
      >
        <Package className="h-5 w-5" />
      </button>

      {isModelLibraryOpen && (
        <div id="editor-model-library" className={`editor-library absolute top-0 z-50 p-3 ${glassPanelClass}`}>
          <div className="editor-panel-heading mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{t('editorModelLibrary')}</p>
            <button type="button" aria-label={t('close')} onClick={() => setIsModelLibraryOpen(false)} className="flex w-9 items-center justify-center rounded-lg hover:bg-white/10"><X className="size-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {modelLibraryButtons.map((tool) => {
              const Icon = tool.icon;
              const label = t(tool.labelKey);
              return (
                <button
                  key={tool.type}
                  onClick={() => handleAddItem(tool.type)}
                  title={label}
                  className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/6 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/12 ${tool.className}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] leading-none">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
