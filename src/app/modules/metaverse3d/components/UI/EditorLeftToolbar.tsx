import { Package } from "lucide-react";
import { ExhibitItem } from "../../types";
import { itemToolButtons, modelLibraryButtons } from "./editorConstants";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  glassPanelClass: string;
  isModelLibraryOpen: boolean;
  setIsModelLibraryOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  handleAddItem: (type: ExhibitItem["type"]) => void;
};

export function EditorLeftToolbar({
  glassPanelClass,
  isModelLibraryOpen,
  setIsModelLibraryOpen,
  handleAddItem,
}: Props) {
  const { t } = useI18n();
  return (
    <div className={`absolute left-3 top-[calc(var(--top-bar-height,6rem)+0.75rem)] z-30 w-[4.2rem] rounded-[1.9rem] border border-white/25 bg-slate-950/45 p-2.5 pointer-events-auto backdrop-blur-2xl shadow-[0_18px_48px_rgba(15,23,42,0.18)] sm:left-4 sm:w-[4.65rem] sm:rounded-[2rem] sm:p-3 ${glassPanelClass}`}>
      <div className="mb-3 px-1 pt-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
        {t('editorAdd')}
      </div>

      <div className="space-y-2">
        {itemToolButtons.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.type}
              onClick={() => handleAddItem(tool.type)}
              title={tool.label}
              className={`group flex h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/12 hover:text-white active:scale-[0.98] ${tool.className}`}
            >
              <Icon className="h-5 w-5 opacity-85 transition-transform duration-200 group-hover:scale-110" />
            </button>
          );
        })}
      </div>

      <div className="my-3 h-px bg-white/10" />

      <button
        onClick={() => setIsModelLibraryOpen((prev) => !prev)}
        title={t('editorModelLibrary')}
        className={`flex h-12 w-full items-center justify-center rounded-2xl border transition-all duration-200 ${
          isModelLibraryOpen
            ? "border-indigo-300/70 bg-indigo-500/18 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.15),0_8px_24px_rgba(79,70,229,0.18)]"
            : "border-white/10 bg-white/6 text-white/85 hover:bg-white/12 hover:text-white"
        }`}
      >
        <Package className="h-5 w-5" />
      </button>

      {isModelLibraryOpen && (
        <div className={`absolute left-[4.95rem] top-0 z-50 w-56 rounded-[1.35rem] border border-white/25 bg-slate-950/55 p-2.5 backdrop-blur-2xl shadow-[0_18px_48px_rgba(15,23,42,0.24)] sm:left-[5.35rem] ${glassPanelClass}`}>
          <p className="px-2 py-1 text-xs font-semibold text-white">{t('editorModelLibrary')}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {modelLibraryButtons.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.type}
                  onClick={() => handleAddItem(tool.type)}
                  title={tool.label}
                  className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/6 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/12 ${tool.className}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] leading-none">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
