import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Progress } from "@/app/components/ui/progress";
import { cn } from "@/app/components/ui/utils";
import { useI18n } from "@/app/components/I18nProvider";
import type { ExhibitionWizardMessageKey } from "@/app/i18n/catalogs/exhibitionWizard";

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
  { shortLabel: ExhibitionWizardMessageKey; title: ExhibitionWizardMessageKey; description: ExhibitionWizardMessageKey }
> = {
  theme: {
    shortLabel: "wizard.themeShort",
    title: "wizard.themeTitle",
    description: "wizard.themeDescription",
  },
  upload: {
    shortLabel: "wizard.uploadShort",
    title: "wizard.uploadTitle",
    description: "wizard.uploadDescription",
  },
  style: {
    shortLabel: "wizard.styleShort",
    title: "wizard.styleTitle",
    description: "wizard.styleDescription",
  },
  layout: {
    shortLabel: "wizard.layoutShort",
    title: "wizard.layoutTitle",
    description: "wizard.layoutDescription",
  },
  preview: {
    shortLabel: "wizard.previewShort",
    title: "wizard.previewTitle",
    description: "wizard.previewDescription",
  },
  publish: {
    shortLabel: "wizard.publishShort",
    title: "wizard.publishTitle",
    description: "wizard.publishDescription",
  },
};

const ERROR_MESSAGES: Record<string, ExhibitionWizardMessageKey> = {
  theme_required: "wizard.errorThemeRequired",
  uploaded_asset_required: "wizard.errorUploadRequired",
  style_required: "wizard.errorStyleRequired",
  layout_required: "wizard.errorLayoutRequired",
  preview_required: "wizard.errorPreviewRequired",
  step_not_reached: "wizard.errorStepNotReached",
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
  const { t } = useI18n();
  const [draft, setDraft] = useState<ExhibitionWizardDraft>(
    () => initialDraft ?? createExhibitionWizardDraft(),
  );
  const draftRef = useRef(draft);
  const [error, setError] = useState<ExhibitionWizardMessageKey | null>(null);
  const currentIndex = EXHIBITION_WIZARD_STEPS.indexOf(draft.currentStep);
  const content = STEP_CONTENT[draft.currentStep];

  function updateDraft(nextDraft: ExhibitionWizardDraft) {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    onDraftChange?.(nextDraft);
  }

  function patchDraft(patch: ExhibitionWizardSlotContext["patch"] extends (
    value: infer Patch,
  ) => void
    ? Patch
    : never) {
    updateDraft(transitionExhibitionWizard(draftRef.current, { type: "patch", patch }));
    setError(null);
  }

  function move(direction: "next" | "back") {
    try {
      updateDraft(transitionExhibitionWizard(draft, { type: direction }));
      setError(null);
    } catch (caught) {
      const code = caught instanceof WizardStepError ? caught.code : "unknown";
      setError(ERROR_MESSAGES[code] ?? "wizard.errorNext");
    }
  }

  function goToStep(step: ExhibitionWizardStep) {
    try {
      updateDraft(transitionExhibitionWizard(draft, { type: "go-to", step }));
      setError(null);
    } catch (caught) {
      const code = caught instanceof WizardStepError ? caught.code : "unknown";
      setError(ERROR_MESSAGES[code] ?? "wizard.errorOpenStep");
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
          <span className="font-medium">{t('wizard.title')}</span>
          <span className="text-muted-foreground">
            {t('wizard.stepCount', { current: currentIndex + 1, total: EXHIBITION_WIZARD_STEPS.length })}
          </span>
        </div>
        <Progress
          value={((currentIndex + 1) / EXHIBITION_WIZARD_STEPS.length) * 100}
          aria-valuenow={Math.round(
            ((currentIndex + 1) / EXHIBITION_WIZARD_STEPS.length) * 100,
          )}
          aria-label={t('wizard.progress', { current: currentIndex + 1, total: EXHIBITION_WIZARD_STEPS.length })}
        />
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={t('wizard.steps')}>
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
                  {t(STEP_CONTENT[step].shortLabel)}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="min-h-64 space-y-6">
        <header className="space-y-1">
          <h2 id="exhibition-wizard-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t(content.title)}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{t(content.description)}</p>
        </header>

        {draft.currentStep === "theme" && (
          <div className="space-y-2">
            <Label htmlFor="exhibition-theme">{t('wizard.themeLabel')}</Label>
            <Input
              id="exhibition-theme"
              value={draft.theme}
              onChange={(event) => patchDraft({ theme: event.target.value })}
              placeholder={t('wizard.themePlaceholder')}
              aria-invalid={error === ERROR_MESSAGES.theme_required}
              aria-describedby="exhibition-wizard-error"
              autoFocus
            />
          </div>
        )}

        {draft.currentStep === "upload" &&
          (renderUpload?.(slotContext) ?? <DefaultSlot>{t('wizard.uploadUnavailable')}</DefaultSlot>)}

        {draft.currentStep === "style" && (
          <div className="space-y-2">
            <Label htmlFor="exhibition-style">{t('wizard.styleLabel')}</Label>
            <Input
              id="exhibition-style"
              value={draft.style}
              onChange={(event) => patchDraft({ style: event.target.value })}
              placeholder={t('wizard.stylePlaceholder')}
              aria-invalid={error === ERROR_MESSAGES.style_required}
              aria-describedby="exhibition-wizard-error"
              autoFocus
            />
          </div>
        )}

        {draft.currentStep === "layout" &&
          (renderLayout?.(slotContext) ?? <DefaultSlot>{t('wizard.layoutUnavailable')}</DefaultSlot>)}

        {draft.currentStep === "preview" &&
          (renderPreview?.(slotContext) ?? <DefaultSlot>{t('wizard.previewUnavailable')}</DefaultSlot>)}

        {draft.currentStep === "publish" &&
          (renderPublish?.(slotContext) ?? <DefaultSlot>{t('wizard.publishUnavailable')}</DefaultSlot>)}
      </div>

      <p
        id="exhibition-wizard-error"
        className="mt-4 min-h-6 text-sm font-medium text-destructive"
        role={error ? "alert" : "status"}
        aria-live="polite"
      >
        {error ? t(error) : null}
      </p>

      <footer className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {currentIndex > 0 ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => move("back")}>
            {t('wizard.back')}
          </Button>
        ) : (
          <span />
        )}
        {draft.currentStep !== "publish" && (
          <Button type="button" className="min-h-11" onClick={() => move("next")}>
            {t('wizard.next')}
          </Button>
        )}
      </footer>
    </section>
  );
}
