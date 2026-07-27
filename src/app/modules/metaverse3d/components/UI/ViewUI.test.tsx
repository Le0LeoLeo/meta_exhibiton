import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExhibitionPassport } from "@/app/api/exhibitionPassport";
import { defaultAgentState } from "../../store/metaverseStoreUtils";
import { useStore } from "../../store/useStore";
import { ViewUI } from "./ViewUI";

const apiMocks = vi.hoisted(() => ({
  getPassport: vi.fn(),
  completePassport: vi.fn(),
  sharePassport: vi.fn(),
  loadMemory: vi.fn(),
  saveMemory: vi.fn(),
}));

vi.mock("../../../../api/auth", () => ({
  loadAuth: () => ({ token: "jwt-token", user: { id: "user-1", name: "Visitor" } }),
}));
vi.mock("../../../../api/exhibitionPassport", () => ({
  getExhibitionPassport: apiMocks.getPassport,
  completeExhibitionPassport: apiMocks.completePassport,
  shareExhibitionPassport: apiMocks.sharePassport,
}));
vi.mock("../../../../api/visitorMemory", () => ({
  loadVisitorMemory: apiMocks.loadMemory,
  saveVisitorMemory: apiMocks.saveMemory,
}));
vi.mock("../../../../components/I18nProvider", () => ({
  useI18n: () => ({ locale: "en", toggleLocale: vi.fn(), t: (key: string) => key }),
}));
vi.mock("./PerformanceModeControl", () => ({ PerformanceModeControl: () => null }));
vi.mock("./ExhibitionPassportPanel", () => ({
  ExhibitionPassportPanel: (props: { state: string; onComplete: () => void }) => (
    <div>
      <span data-testid="passport-state">{props.state}</span>
      <button type="button" onClick={props.onComplete}>open-passport</button>
    </div>
  ),
}));
vi.mock("./PassportCompletionDialog", () => ({
  PassportCompletionDialog: (props: {
    open: boolean;
    completionError?: string | null;
    onComplete: (reflection: string) => Promise<void>;
    onShare: () => Promise<unknown>;
  }) => props.open ? (
    <div>
      <span data-testid="completion-error">{props.completionError ?? "none"}</span>
      <button type="button" onClick={() => void props.onComplete("A reflection").catch(() => {})}>dialog-complete</button>
      <button type="button" onClick={() => void props.onShare()}>dialog-share</button>
    </div>
  ) : null,
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
  progress: { completedTaskIds: [], visitedCount: 0, engagedCount: 0, longestDwellSeconds: 0, complete: false },
  souvenir: null,
};

const completedPassport: ExhibitionPassport = {
  ...activePassport,
  status: "completed",
  progress: { completedTaskIds: activePassport.tasks.map((task) => task.id), visitedCount: 1, engagedCount: 1, longestDwellSeconds: 20, complete: true },
  souvenir: {
    schemaVersion: 1,
    galleryId: "gallery-1",
    galleryTitle: "Gallery",
    galleryOwnerName: "Owner",
    completedAt: "2026-07-22T00:00:00.000Z",
    visitedCount: 1,
    engagedCount: 1,
    totalDwellSeconds: 20,
    favoriteExhibit: null,
    reflection: "A reflection",
  },
};

function resetStore() {
  useStore.setState({
    mode: "view",
    hasSelectedParticipationMode: true,
    viewingItem: null,
    items: [{ id: "art-1", type: "painting", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: "" }],
    agent: {
      ...defaultAgentState,
      memory: {
        ...defaultAgentState.memory,
        visitedExhibitIds: ["art-1"],
        engagedExhibitIds: ["art-1"],
        dwellSecondsByExhibit: { "art-1": 20 },
      },
    },
  });
}

describe("ViewUI exhibition passport integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    apiMocks.getPassport.mockResolvedValue(activePassport);
    apiMocks.loadMemory.mockResolvedValue({ memory: null });
    apiMocks.saveMemory.mockResolvedValue({ ok: true });
    apiMocks.completePassport.mockResolvedValue(completedPassport);
    apiMocks.sharePassport.mockResolvedValue({ token: "token-1", sharePath: "/souvenirs/token-1" });
  });

  afterEach(cleanup);

  it("does not create a passport while the studio is outside view mode", async () => {
    useStore.setState({ mode: "edit" });

    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);

    await waitFor(() => expect(apiMocks.getPassport).not.toHaveBeenCalled());
  });

  it("loads once and does not refetch as optimistic dwell progress changes", async () => {
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("passport-state")).toHaveTextContent("ready"));
    expect(apiMocks.getPassport).toHaveBeenCalledOnce();

    useStore.setState((state) => ({
      agent: {
        ...state.agent,
        memory: { ...state.agent.memory, dwellSecondsByExhibit: { "art-1": 24 } },
      },
    }));

    await waitFor(() => expect(apiMocks.getPassport).toHaveBeenCalledOnce());
  });

  it("flushes the latest memory before requesting authoritative completion", async () => {
    const order: string[] = [];
    apiMocks.saveMemory.mockImplementation(async () => { order.push("save"); return { ok: true }; });
    apiMocks.completePassport.mockImplementation(async () => { order.push("complete"); return completedPassport; });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("passport-state")).toHaveTextContent("ready"));
    fireEvent.click(screen.getByRole("button", { name: "open-passport" }));
    fireEvent.click(screen.getByRole("button", { name: "dialog-complete" }));

    await waitFor(() => expect(apiMocks.completePassport).toHaveBeenCalledWith("jwt-token", "gallery-1", "A reflection"));
    expect(order.slice(0, 2)).toEqual(["save", "complete"]);
    expect(apiMocks.sharePassport).not.toHaveBeenCalled();
  });

  it("refreshes and reports a sync conflict after an authoritative 409", async () => {
    apiMocks.completePassport.mockRejectedValue(Object.assign(new Error("incomplete"), { status: 409, code: "PASSPORT_INCOMPLETE" }));
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("passport-state")).toHaveTextContent("ready"));
    fireEvent.click(screen.getByRole("button", { name: "open-passport" }));
    fireEvent.click(screen.getByRole("button", { name: "dialog-complete" }));

    await waitFor(() => expect(screen.getByTestId("completion-error")).toHaveTextContent("sync"));
    expect(apiMocks.getPassport).toHaveBeenCalledTimes(2);
  });
});
