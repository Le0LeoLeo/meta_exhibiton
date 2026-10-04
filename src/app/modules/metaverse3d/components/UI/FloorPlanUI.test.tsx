import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
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

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

  it("switches settings panels without stacking them and preserves selection on Escape", () => {
    renderFloorPlanUI();
    expect(document.getElementById('floorplan-inspector')).toBeInTheDocument();
    const space = screen.getByRole('button', { name: '空間尺寸與材質' });
    fireEvent.click(space);
    expect(document.getElementById('floorplan-space')).toBeInTheDocument();
    expect(document.getElementById('floorplan-inspector')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.getElementById('floorplan-space')).not.toBeInTheDocument();
    expect(useStore.getState().selectedFloorPlanElementId).toBe('room-1');
    expect(space).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '平面元素設定' }));
    expect(document.getElementById('floorplan-inspector')).toBeInTheDocument();
  });

  it("keeps the protected room delete control disabled and supports wall duplication", () => {
    renderFloorPlanUI();
    expect(screen.getByRole('button', { name: '刪除', exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '編輯牆線' }));
    expect(screen.getByRole('button', { name: '刪除', exact: true })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '複製選取' }));
    expect(useStore.getState().floorPlanElements.filter(element => element.type === 'wall')).toHaveLength(2);
  });

  it("edits the selected room dimensions through the settings panel", () => {
    renderFloorPlanUI();
    fireEvent.click(screen.getByRole('button', { name: '空間尺寸與材質' }));
    const width = screen.getByRole('spinbutton', { name: '寬度（選中展間）' });
    fireEvent.focus(width);
    fireEvent.change(width, { target: { value: '16' } });
    fireEvent.blur(width);
    expect(useStore.getState().floorPlanElements.find(element => element.id === 'room-1')?.scale).toEqual([16, 0.04, 10]);
    expect(screen.getByRole('button', { name: '復原', exact: true })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '復原', exact: true }));
    expect(useStore.getState().floorPlanElements.find(element => element.id === 'room-1')?.scale).toEqual(room.scale);
  });
});
