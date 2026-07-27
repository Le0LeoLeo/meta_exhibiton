import { useState, type ReactNode } from "react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Progress } from "@/app/components/ui/progress";
import { cn } from "@/app/components/ui/utils";

import {
  createExhibitionWizardDraft,
  EXHIBITION_WIZARD_STEPS,
  transitionExhibitionWizard,
  WizardStepError,
  type ExhibitionWizardDraft,
  type ExhibitionWizardStep,
} from "./wizardStore";

const STEP_CONTENT: Record<
  ExhibitionWizardStep,
  { shortLabel: string; title: string; description: string }
> = {
  theme: {
    shortLabel: "主題",
    title: "設定展覽主題",
    description: "先用一句話說明這次成果展的主題。",
  },
  upload: {
    shortLabel: "作品",
    title: "上傳學生作品",
    description: "加入要展示的圖片、文件、影片或作品資料。",
  },
  style: {
    shortLabel: "風格",
    title: "選擇展覽風格",
    description: "描述希望 AI 採用的空間氣氛與視覺方向。",
  },
  layout: {
    shortLabel: "排展",
    title: "AI 自動排展",
    description: "檢查作品配置、燈光與參觀動線。",
  },
  preview: {
    shortLabel: "預覽",
    title: "預覽展覽",
    description: "在發布前確認展品內容與參觀體驗。",
  },
  publish: {
    shortLabel: "發布",
    title: "發布成果展",
    description: "設定分享方式，讓訪客進入展覽。",
  },
};

const ERROR_MESSAGES: Record<string, string> = {
  theme_required: "請先輸入展覽主題",
  uploaded_asset_required: "請先完成至少一件作品的上傳",
  style_required: "請先輸入展覽風格",
  layout_required: "請先完成 AI 排展",
  preview_required: "請先完成展覽預覽",
  step_not_reached: "請依序完成前面的步驟",
};

export type ExhibitionWizardSlotContext = {
  draft: ExhibitionWizardDraft;
  patch: (
    patch: Partial<
      Omit<
        ExhibitionWizardDraft,
        "schemaVersion" | "currentStep" | "furthestStep"
      >
    >,
  ) => void;
};

export type ExhibitionWizardProps = {
  initialDraft?: ExhibitionWizardDraft;
  onDraftChange?: (draft: ExhibitionWizardDraft) => void;
  renderUpload?: (context: ExhibitionWizardSlotContext) => ReactNode;
  renderLayout?: (context: ExhibitionWizardSlotContext) => ReactNode;
  renderPreview?: (context: ExhibitionWizardSlotContext) => ReactNode;
  renderPublish?: (context: ExhibitionWizardSlotContext) => ReactNode;
  className?: string;
};

function DefaultSlot({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function ExhibitionWizard({
  initialDraft,
  onDraftChange,
  renderUpload,
  renderLayout,
  renderPreview,
  renderPublish,
  className,
}: ExhibitionWizardProps) {
  const [draft, setDraft] = useState<ExhibitionWizardDraft>(
    () => initialDraft ?? createExhibitionWizardDraft(),
  );
  const [error, setError] = useState("");
  const currentIndex = EXHIBITION_WIZARD_STEPS.indexOf(draft.currentStep);
  const content = STEP_CONTENT[draft.currentStep];

  function updateDraft(nextDraft: ExhibitionWizardDraft) {
    setDraft(nextDraft);
    onDraftChange?.(nextDraft);
  }

  function patchDraft(patch: ExhibitionWizardSlotContext["patch"] extends (
    value: infer Patch,
  ) => void
    ? Patch
    : never) {
    updateDraft(transitionExhibitionWizard(draft, { type: "patch", patch }));
    setError("");
  }

  function move(direction: "next" | "back") {
    try {
      updateDraft(transitionExhibitionWizard(draft, { type: direction }));
      setError("");
    } catch (caught) {
      const code = caught instanceof WizardStepError ? caught.code : "unknown";
      setError(ERROR_MESSAGES[code] ?? "無法前往下一步，請檢查目前內容");
    }
  }

  function goToStep(step: ExhibitionWizardStep) {
    try {
      updateDraft(transitionExhibitionWizard(draft, { type: "go-to", step }));
      setError("");
    } catch (caught) {
      const code = caught instanceof WizardStepError ? caught.code : "unknown";
      setError(ERROR_MESSAGES[code] ?? "暫時無法開啟這個步驟");
    }
  }

  const slotContext: ExhibitionWizardSlotContext = { draft, patch: patchDraft };

  return (
    <section
      data-slot="exhibition-wizard"
      className={cn(
        "mx-auto w-full max-w-4xl rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6",
        className,
      )}
      aria-labelledby="exhibition-wizard-title"
    >
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">建立 3D 成果展</span>
          <span className="text-muted-foreground">
            第 {currentIndex + 1} / {EXHIBITION_WIZARD_STEPS.length} 步
          </span>
        </div>
        <Progress
          value={((currentIndex + 1) / EXHIBITION_WIZARD_STEPS.length) * 100}
          aria-valuenow={Math.round(
            ((currentIndex + 1) / EXHIBITION_WIZARD_STEPS.length) * 100,
          )}
          aria-label={`建展進度：第 ${currentIndex + 1} 步，共 ${EXHIBITION_WIZARD_STEPS.length} 步`}
        />
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="建展步驟">
          {EXHIBITION_WIZARD_STEPS.map((step, index) => {
            const reached = index <= EXHIBITION_WIZARD_STEPS.indexOf(draft.furthestStep);
            const current = step === draft.currentStep;
            return (
              <li key={step}>
                <button
                  type="button"
                  className={cn(
                    "min-h-11 w-full rounded-md px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    current
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                  aria-current={current ? "step" : undefined}
                  disabled={!reached}
                  onClick={() => goToStep(step)}
                >
                  <span aria-hidden="true">{index + 1}. </span>
                  {STEP_CONTENT[step].shortLabel}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="min-h-64 space-y-6">
        <header className="space-y-1">
          <h2 id="exhibition-wizard-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
            {content.title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{content.description}</p>
        </header>

        {draft.currentStep === "theme" && (
          <div className="space-y-2">
            <Label htmlFor="exhibition-theme">展覽主題</Label>
            <Input
              id="exhibition-theme"
              value={draft.theme}
              onChange={(event) => patchDraft({ theme: event.target.value })}
              placeholder="例如：六年級畢業成果展"
              aria-invalid={error === ERROR_MESSAGES.theme_required}
              aria-describedby="exhibition-wizard-error"
              autoFocus
            />
          </div>
        )}

        {draft.currentStep === "upload" &&
          (renderUpload?.(slotContext) ?? <DefaultSlot>在這裡接入批量上傳與作品資料匯入。</DefaultSlot>)}

        {draft.currentStep === "style" && (
          <div className="space-y-2">
            <Label htmlFor="exhibition-style">展覽風格</Label>
            <Input
              id="exhibition-style"
              value={draft.style}
              onChange={(event) => patchDraft({ style: event.target.value })}
              placeholder="例如：明亮、現代、適合校園作品"
              aria-invalid={error === ERROR_MESSAGES.style_required}
              aria-describedby="exhibition-wizard-error"
              autoFocus
            />
          </div>
        )}

        {draft.currentStep === "layout" &&
          (renderLayout?.(slotContext) ?? <DefaultSlot>在這裡接入 AI 排展工作。</DefaultSlot>)}

        {draft.currentStep === "preview" &&
          (renderPreview?.(slotContext) ?? <DefaultSlot>在這裡接入 3D 或 2D 預覽。</DefaultSlot>)}

        {draft.currentStep === "publish" &&
          (renderPublish?.(slotContext) ?? <DefaultSlot>在這裡接入發布與分享設定。</DefaultSlot>)}
      </div>

      <p
        id="exhibition-wizard-error"
        className="mt-4 min-h-6 text-sm font-medium text-destructive"
        role={error ? "alert" : "status"}
        aria-live="polite"
      >
        {error}
      </p>

      <footer className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {currentIndex > 0 ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => move("back")}>
            返回
          </Button>
        ) : (
          <span />
        )}
        {draft.currentStep !== "publish" && (
          <Button type="button" className="min-h-11" onClick={() => move("next")}>
            下一步
          </Button>
        )}
      </footer>
    </section>
  );
}
