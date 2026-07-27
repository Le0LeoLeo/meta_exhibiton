export const EXHIBITION_WIZARD_STEPS = [
  "theme",
  "upload",
  "style",
  "layout",
  "preview",
  "publish",
] as const;

export type ExhibitionWizardStep = (typeof EXHIBITION_WIZARD_STEPS)[number];

export type WizardAsset = {
  id: string;
  fileName: string;
  status: "pending" | "uploading" | "succeeded" | "failed";
  url?: string;
  previewUrl?: string;
  mimeType?: string;
  error?: string;
  studentCode?: string;
  title?: string;
  authorDisplayName?: string;
  description?: string;
};

export type ExhibitionWizardDraft = {
  schemaVersion: 1;
  galleryId: string | null;
  currentStep: ExhibitionWizardStep;
  furthestStep: ExhibitionWizardStep;
  theme: string;
  assets: WizardAsset[];
  style: string;
  layoutStatus: "idle" | "running" | "complete" | "failed";
  aiJobId: string | null;
  previewReady: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

export type WizardEvent =
  | { type: "next" }
  | { type: "back" }
  | { type: "go-to"; step: ExhibitionWizardStep }
  | { type: "patch"; patch: Partial<Omit<ExhibitionWizardDraft, "schemaVersion" | "currentStep" | "furthestStep">> };

export class WizardStepError extends Error {
  constructor(
    public readonly step: ExhibitionWizardStep,
    public readonly code: string,
  ) {
    super(code);
    this.name = "WizardStepError";
  }
}

const stepIndex = (step: ExhibitionWizardStep) =>
  EXHIBITION_WIZARD_STEPS.indexOf(step);

const laterStep = (
  left: ExhibitionWizardStep,
  right: ExhibitionWizardStep,
) => (stepIndex(left) >= stepIndex(right) ? left : right);

export function createExhibitionWizardDraft(
  now = new Date().toISOString(),
): ExhibitionWizardDraft {
  return {
    schemaVersion: 1,
    galleryId: null,
    currentStep: "theme",
    furthestStep: "theme",
    theme: "",
    assets: [],
    style: "",
    layoutStatus: "idle",
    aiJobId: null,
    previewReady: false,
    publishedAt: null,
    updatedAt: now,
  };
}

export function validateWizardStep(
  draft: ExhibitionWizardDraft,
  step = draft.currentStep,
): void {
  if (step === "theme" && !draft.theme.trim()) {
    throw new WizardStepError(step, "theme_required");
  }
  if (
    step === "upload" &&
    !draft.assets.some((asset) => asset.status === "succeeded")
  ) {
    throw new WizardStepError(step, "uploaded_asset_required");
  }
  if (step === "style" && !draft.style.trim()) {
    throw new WizardStepError(step, "style_required");
  }
  if (step === "layout" && draft.layoutStatus !== "complete") {
    throw new WizardStepError(step, "layout_required");
  }
  if (step === "preview" && !draft.previewReady) {
    throw new WizardStepError(step, "preview_required");
  }
}

export function transitionExhibitionWizard(
  draft: ExhibitionWizardDraft,
  event: WizardEvent,
  now = new Date().toISOString(),
): ExhibitionWizardDraft {
  if (event.type === "patch") {
    return { ...draft, ...event.patch, updatedAt: now };
  }

  const currentIndex = stepIndex(draft.currentStep);
  if (event.type === "back") {
    const previous = EXHIBITION_WIZARD_STEPS[Math.max(0, currentIndex - 1)];
    return { ...draft, currentStep: previous, updatedAt: now };
  }

  if (event.type === "go-to") {
    if (stepIndex(event.step) > stepIndex(draft.furthestStep)) {
      throw new WizardStepError(draft.currentStep, "step_not_reached");
    }
    return { ...draft, currentStep: event.step, updatedAt: now };
  }

  validateWizardStep(draft);
  const next = EXHIBITION_WIZARD_STEPS[currentIndex + 1] ?? draft.currentStep;
  return {
    ...draft,
    currentStep: next,
    furthestStep: laterStep(draft.furthestStep, next),
    updatedAt: now,
  };
}

export function restoreExhibitionWizardDraft(
  value: string | null,
): ExhibitionWizardDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ExhibitionWizardDraft>;
    if (
      parsed.schemaVersion !== 1 ||
      !EXHIBITION_WIZARD_STEPS.includes(parsed.currentStep as ExhibitionWizardStep) ||
      !EXHIBITION_WIZARD_STEPS.includes(parsed.furthestStep as ExhibitionWizardStep) ||
      typeof parsed.theme !== "string" ||
      typeof parsed.style !== "string" ||
      !Array.isArray(parsed.assets) ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }
    return parsed as ExhibitionWizardDraft;
  } catch {
    return null;
  }
}
