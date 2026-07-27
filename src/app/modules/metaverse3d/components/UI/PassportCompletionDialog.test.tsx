import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExhibitionPassport } from "@/app/api/exhibitionPassport";
import { PassportCompletionDialog } from "./PassportCompletionDialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/components/I18nProvider", () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        passportCompleteTitle: "Complete passport",
        passportCompleteDescription: "Add a reflection",
        passportCompletedTitle: "Your private souvenir",
        passportCompletedDescription: "Completed",
        passportReflectionLabel: "Reflection",
        passportReflectionPlaceholder: "What stayed with you?",
        passportReflectionCount: "{count} / {max}",
        passportPrivacyNotice: "Private until you choose Share",
        passportClose: "Close",
        passportCompleteAction: "Complete",
        passportCompleting: "Completing",
        passportPrivateSouvenir: "Private souvenir",
        passportShareAction: "Share",
        passportSharing: "Sharing",
        passportShareText: "My exhibition journey",
        passportSouvenirTitle: "Exhibition souvenir",
        passportShareUrlLabel: "Share URL",
        passportCopyLink: "Copy link",
        passportOpenShareLink: "Open link",
      };
      return (labels[key] ?? key).replace(/\{(\w+)\}/g, (_, token) => String(values?.[token] ?? ""));
    },
  }),
}));

const activePassport: ExhibitionPassport = {
  id: "passport-1",
  galleryId: "gallery-1",
  status: "active",
  tasks: [
    { id: "visit-count", kind: "visit-count", target: 1 },
    { id: "dwell-one", kind: "dwell-one", targetSeconds: 20 },
    { id: "engage-count", kind: "engage-count", target: 1 },
  ],
  progress: { completedTaskIds: ["visit-count", "dwell-one", "engage-count"], visitedCount: 1, engagedCount: 1, longestDwellSeconds: 20, complete: true },
  souvenir: null,
};

const completedPassport: ExhibitionPassport = {
  ...activePassport,
  status: "completed",
  souvenir: {
    schemaVersion: 1,
    galleryId: "gallery-1",
    galleryTitle: "Night Museum",
    galleryOwnerName: "Curator",
    completedAt: "2026-07-22T00:00:00.000Z",
    visitedCount: 1,
    engagedCount: 1,
    totalDwellSeconds: 20,
    favoriteExhibit: null,
    reflection: "A quiet room.",
  },
};

function renderDialog(passport: ExhibitionPassport, onComplete = vi.fn(async () => {}), onShare = vi.fn(async () => ({ sharePath: "/souvenirs/token-1" }))) {
  render(<PassportCompletionDialog open passport={passport} onOpenChange={vi.fn()} onComplete={onComplete} onShare={onShare} />);
  return { onComplete, onShare };
}

describe("PassportCompletionDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => {}) } });
  });

  it("caps reflection at 280 characters and completes with the capped value", async () => {
    const { onComplete, onShare } = renderDialog(activePassport);
    fireEvent.change(screen.getByLabelText("Reflection"), { target: { value: "a".repeat(300) } });
    expect(screen.getByLabelText("Reflection")).toHaveValue("a".repeat(280));
    expect(screen.getByText("280 / 280")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("a".repeat(280)));
    expect(onShare).not.toHaveBeenCalled();
  });

  it("keeps a completed souvenir private until Share is pressed", async () => {
    const { onShare } = renderDialog(completedPassport);
    expect(screen.getByText("Private until you choose Share")).toBeInTheDocument();
    expect(onShare).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(onShare).toHaveBeenCalledOnce());
    expect(await screen.findByDisplayValue("http://localhost:3000/souvenirs/token-1")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://localhost:3000/souvenirs/token-1");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });
});
