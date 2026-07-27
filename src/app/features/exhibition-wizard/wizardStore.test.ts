import { describe, expect, it } from "vitest";

import {
  createExhibitionWizardDraft,
  restoreExhibitionWizardDraft,
  transitionExhibitionWizard,
  WizardStepError,
} from "./wizardStore";

const now = "2026-07-15T00:00:00.000Z";

describe("exhibition wizard state machine", () => {
  it("requires each step before advancing through the six-step workflow", () => {
    let draft = createExhibitionWizardDraft(now);
    expect(() => transitionExhibitionWizard(draft, { type: "next" }, now)).toThrowError(
      new WizardStepError("theme", "theme_required"),
    );

    draft = transitionExhibitionWizard(draft, {
      type: "patch",
      patch: { theme: "Class 6 graduation exhibition" },
    }, now);
    draft = transitionExhibitionWizard(draft, { type: "next" }, now);
    expect(draft.currentStep).toBe("upload");

    draft = transitionExhibitionWizard(draft, {
      type: "patch",
      patch: {
        assets: [{ id: "asset-1", fileName: "work.jpg", status: "succeeded" }],
      },
    }, now);
    draft = transitionExhibitionWizard(draft, { type: "next" }, now);
    draft = transitionExhibitionWizard(draft, {
      type: "patch",
      patch: { style: "white-box" },
    }, now);
    draft = transitionExhibitionWizard(draft, { type: "next" }, now);
    draft = transitionExhibitionWizard(draft, {
      type: "patch",
      patch: { layoutStatus: "complete", aiJobId: "job-1" },
    }, now);
    draft = transitionExhibitionWizard(draft, { type: "next" }, now);
    draft = transitionExhibitionWizard(draft, {
      type: "patch",
      patch: { previewReady: true },
    }, now);
    draft = transitionExhibitionWizard(draft, { type: "next" }, now);

    expect(draft.currentStep).toBe("publish");
    expect(draft.furthestStep).toBe("publish");
  });

  it("lets users return to completed steps without losing draft data", () => {
    let draft = createExhibitionWizardDraft(now);
    draft = transitionExhibitionWizard(draft, {
      type: "patch",
      patch: { theme: "History project" },
    }, now);
    draft = transitionExhibitionWizard(draft, { type: "next" }, now);
    draft = transitionExhibitionWizard(draft, { type: "back" }, now);

    expect(draft.currentStep).toBe("theme");
    expect(draft.furthestStep).toBe("upload");
    expect(draft.theme).toBe("History project");
  });

  it("rejects jumping ahead and ignores invalid persisted drafts", () => {
    const draft = createExhibitionWizardDraft(now);
    expect(() => transitionExhibitionWizard(
      draft,
      { type: "go-to", step: "publish" },
      now,
    )).toThrowError(new WizardStepError("theme", "step_not_reached"));

    expect(restoreExhibitionWizardDraft("not json")).toBeNull();
    expect(restoreExhibitionWizardDraft(JSON.stringify({ schemaVersion: 9 }))).toBeNull();
    expect(restoreExhibitionWizardDraft(JSON.stringify(draft))).toEqual(draft);
  });
});
