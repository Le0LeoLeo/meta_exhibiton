import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExhibitionPassport, PassportProgress } from "@/app/api/exhibitionPassport";
import { ExhibitionPassportPanel } from "./ExhibitionPassportPanel";

vi.mock("@/app/components/I18nProvider", () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        passportTitle: "Exhibition passport",
        passportToggleLabel: "Passport {completed} / {total}",
        passportLoading: "Loading passport",
        passportUnavailable: "Passport unavailable",
        passportSignInPrompt: "Sign in to save progress",
        passportSignIn: "Sign in",
        passportLoadError: "Could not load passport",
        passportRetry: "Retry",
        passportProgress: "{completed} / {total}",
        passportTaskVisit: "Visit {target}",
        passportTaskDwell: "Stay {seconds} seconds",
        passportTaskEngage: "Engage {target}",
        passportTaskComplete: "Complete",
        passportTaskIncomplete: "Incomplete",
        passportCompleteAction: "Complete passport",
        passportViewSouvenir: "View souvenir",
      };
      return (labels[key] ?? key).replace(/\{(\w+)\}/g, (_, token) => String(values?.[token] ?? ""));
    },
  }),
}));

const passport: ExhibitionPassport = {
  id: "passport-1",
  galleryId: "gallery-1",
  status: "active",
  tasks: [
    { id: "visit-count", kind: "visit-count", target: 3 },
    { id: "dwell-one", kind: "dwell-one", targetSeconds: 20 },
    { id: "engage-count", kind: "engage-count", target: 1 },
  ],
  progress: { completedTaskIds: [], visitedCount: 0, engagedCount: 0, longestDwellSeconds: 0, complete: false },
  souvenir: null,
};

const progress: PassportProgress = {
  completedTaskIds: ["visit-count", "dwell-one"],
  visitedCount: 3,
  engagedCount: 0,
  longestDwellSeconds: 20,
  complete: false,
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof ExhibitionPassportPanel>> = {}) {
  return render(
    <MemoryRouter>
      <ExhibitionPassportPanel passport={passport} progress={progress} state="ready" onRetry={vi.fn()} onComplete={vi.fn()} {...overrides} />
    </MemoryRouter>,
  );
}

describe("ExhibitionPassportPanel", () => {
  afterEach(cleanup);

  it("renders loading, unavailable, and signed-out states", () => {
    const view = renderPanel({ passport: null, progress: null, state: "loading" });
    expect(screen.getByRole("status")).toHaveTextContent("Loading passport");
    view.rerender(<MemoryRouter><ExhibitionPassportPanel passport={null} progress={null} state="unavailable" onRetry={vi.fn()} onComplete={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("Passport unavailable")).toBeInTheDocument();
    view.rerender(<MemoryRouter><ExhibitionPassportPanel passport={null} progress={null} state="signed-out" onRetry={vi.fn()} onComplete={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("shows textual task state and a 2 / 3 summary", () => {
    renderPanel();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getAllByText("Complete")).toHaveLength(2);
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });

  it("uses native buttons to collapse and restore the panel", () => {
    renderPanel();
    const toggle = screen.getByRole("button", { name: "Passport 2 / 3" });
    expect(toggle.tagName).toBe("BUTTON");
    fireEvent.click(toggle);
    expect(screen.queryByText("Exhibition passport")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Passport 2 / 3" }));
    expect(screen.getByText("Exhibition passport")).toBeInTheDocument();
  });

  it("retries errors and enables completion only when all tasks are complete", () => {
    const onRetry = vi.fn();
    const onComplete = vi.fn();
    const view = renderPanel({ passport: null, progress: null, state: "error", onRetry });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    view.rerender(<MemoryRouter><ExhibitionPassportPanel passport={passport} progress={{ ...progress, completedTaskIds: passport.tasks.map((task) => task.id), complete: true }} state="ready" onRetry={onRetry} onComplete={onComplete} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Complete passport" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
