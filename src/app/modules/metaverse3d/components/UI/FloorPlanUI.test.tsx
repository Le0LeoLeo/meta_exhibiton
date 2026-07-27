import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "../../../../components/I18nProvider";
import { useStore } from "../../store/useStore";
import { FloorPlanUI } from "./FloorPlanUI";

const room = {
  id: "room-1",
  type: "room" as const,
  position: [0, 0.02, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [12, 0.04, 10] as [number, number, number],
  color: "#dbeafe",
  isLocked: true,
};

const wall = {
  id: "wall-1",
  type: "wall" as const,
  position: [0, 0.1, 2] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [5, 0.2, 0.2] as [number, number, number],
  color: "#9ca3af",
};

function renderFloorPlanUI() {
  return render(
    <I18nProvider>
      <FloorPlanUI />
    </I18nProvider>,
  );
}

describe("FloorPlanUI workflow", () => {
  beforeEach(() => {
    window.localStorage.setItem("metaexpo-locale", "zh-TW");
    useStore.setState({
      mode: "floor-plan",
      floorPlanElements: [room, wall],
      floorPlanEditTarget: "room",
      selectedFloorPlanElementId: null,
      undoStack: [],
      redoStack: [],
    });
  });

  afterEach(() => cleanup());

  it("selects the first editable room when the mode opens", async () => {
    renderFloorPlanUI();

    await waitFor(() => {
      expect(useStore.getState().selectedFloorPlanElementId).toBe("room-1");
    });
  });

  it("switches the edit target and selection together", async () => {
    renderFloorPlanUI();

    fireEvent.click(screen.getByRole("button", { name: "編輯牆線" }));

    await waitFor(() => {
      expect(useStore.getState().floorPlanEditTarget).toBe("wall");
      expect(useStore.getState().selectedFloorPlanElementId).toBe("wall-1");
    });
  });

  it("uses distinct accessible names for editing and adding", () => {
    renderFloorPlanUI();

    expect(screen.getByRole("button", { name: "編輯房間" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "編輯牆線" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增房間" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增牆線" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "從 3D 重新同步" })).not.toBeInTheDocument();
  });
});
