import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetaverseStudioStore as useStore } from "./useMetaverseStudioStore";

const initial = useStore.getState();
beforeEach(() => {
  useStore.setState({ ...initial, mode: "view", hasSelectedParticipationMode: true, viewingItem: initial.items[0] }, true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => { vi.unstubAllGlobals(); useStore.setState(initial, true); });

describe("mobile editing mode restriction", () => {
  it.each(["edit", "floor-plan"] as const)("rejects %s without changing the scene or current visit", (mode) => {
    const before = useStore.getState();
    useStore.getState().setMode(mode);
    const after = useStore.getState();
    expect(after.mode).toBe("view");
    expect(after.items).toBe(before.items);
    expect(after.floorPlanElements).toBe(before.floorPlanElements);
    expect(after.undoStack).toBe(before.undoStack);
    expect(after.viewingItem).toBe(before.viewingItem);
    expect(after.hasSelectedParticipationMode).toBe(true);
  });
  it("allows mobile visitors to leave a stale editor state for viewing", () => {
    useStore.setState({ mode: "edit" });
    useStore.getState().setMode("view");
    expect(useStore.getState().mode).toBe("view");
  });
  it("preserves desktop edit and floor-plan transitions", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    useStore.getState().setMode("edit");
    expect(useStore.getState().mode).toBe("edit");
    useStore.getState().setMode("floor-plan");
    expect(useStore.getState().mode).toBe("floor-plan");
  });
});
