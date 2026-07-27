import { beforeEach, describe, expect, it } from "vitest";

import type { ExhibitItem } from "../types";
import { defaultGalleryScene } from "./defaultGalleryScene";
import { useMetaverseStudioStore } from "./useMetaverseStudioStore";

const createItem = (id: string, position: [number, number, number], type: ExhibitItem["type"] = "painting"): ExhibitItem => ({
  id,
  type,
  position,
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  content: "",
});

describe("useMetaverseStudioStore editor arrangement actions", () => {
  beforeEach(() => {
    useMetaverseStudioStore.setState({
      mode: "edit",
      roomSize: defaultGalleryScene.roomSize,
      items: [],
      selectedItemId: null,
      selectedItemIds: [],
      floorPlanElements: defaultGalleryScene.floorPlanElements,
      wallMaterialOverrides: defaultGalleryScene.wallMaterialOverrides,
      undoStack: [],
      redoStack: [],
    });
  });

  it("snaps selected items to the edit grid and supports undo", () => {
    useMetaverseStudioStore.setState({
      items: [
        createItem("painting-1", [0.24, 1.35, -1.26]),
        createItem("painting-2", [1.74, 1.2, 2.26]),
        createItem("painting-3", [2.13, 1.4, 3.13]),
      ],
      selectedItemId: "painting-1",
      selectedItemIds: ["painting-1", "painting-2"],
    });

    useMetaverseStudioStore.getState().snapSelectedItemsToGrid();

    expect(useMetaverseStudioStore.getState().items).toEqual([
      expect.objectContaining({ id: "painting-1", position: [0, 1.35, -1.5] }),
      expect.objectContaining({ id: "painting-2", position: [1.5, 1.2, 2.5] }),
      expect.objectContaining({ id: "painting-3", position: [2.13, 1.4, 3.13] }),
    ]);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(1);

    useMetaverseStudioStore.getState().undo();

    expect(useMetaverseStudioStore.getState().items[0].position).toEqual([0.24, 1.35, -1.26]);
    expect(useMetaverseStudioStore.getState().items[1].position).toEqual([1.74, 1.2, 2.26]);
    expect(useMetaverseStudioStore.getState().selectedItemId).toBe("painting-1");
    expect(useMetaverseStudioStore.getState().selectedItemIds).toEqual(["painting-1", "painting-2"]);

    useMetaverseStudioStore.getState().redo();

    expect(useMetaverseStudioStore.getState().selectedItemId).toBe("painting-1");
    expect(useMetaverseStudioStore.getState().selectedItemIds).toEqual(["painting-1", "painting-2"]);
  });

  it("aligns selected items to the primary selection on one axis", () => {
    useMetaverseStudioStore.setState({
      items: [
        createItem("painting-1", [2, 1.5, -1]),
        createItem("painting-2", [-3, 1.5, 4]),
        createItem("painting-3", [5, 1.5, 7]),
      ],
      selectedItemId: "painting-2",
      selectedItemIds: ["painting-1", "painting-2", "painting-3"],
    });

    useMetaverseStudioStore.getState().alignSelectedItems("x");

    expect(useMetaverseStudioStore.getState().items).toEqual([
      expect.objectContaining({ id: "painting-1", position: [-3, 1.5, -1] }),
      expect.objectContaining({ id: "painting-2", position: [-3, 1.5, 4] }),
      expect.objectContaining({ id: "painting-3", position: [-3, 1.5, 7] }),
    ]);
  });

  it("distributes selected items evenly along one axis", () => {
    useMetaverseStudioStore.setState({
      items: [
        createItem("painting-1", [0, 1.5, 0]),
        createItem("painting-2", [8, 1.5, 1]),
        createItem("painting-3", [2, 1.5, 2]),
      ],
      selectedItemId: "painting-1",
      selectedItemIds: ["painting-1", "painting-2", "painting-3"],
    });

    useMetaverseStudioStore.getState().distributeSelectedItems("x");

    expect(useMetaverseStudioStore.getState().items).toEqual([
      expect.objectContaining({ id: "painting-1", position: [0, 1.5, 0] }),
      expect.objectContaining({ id: "painting-2", position: [8, 1.5, 1] }),
      expect.objectContaining({ id: "painting-3", position: [4, 1.5, 2] }),
    ]);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(1);
  });

  it("does not move locked partitions during multi-selection moves", () => {
    useMetaverseStudioStore.setState({
      items: [
        createItem("painting-1", [0, 1.5, 0]),
        {
          ...createItem("partition-1", [2, 2, 0], "partition"),
          isLocked: true,
        },
      ],
      selectedItemId: "painting-1",
      selectedItemIds: ["painting-1", "partition-1"],
    });

    useMetaverseStudioStore.getState().moveSelectedItems([1, 0, 1]);

    expect(useMetaverseStudioStore.getState().items).toEqual([
      expect.objectContaining({ id: "painting-1", position: [1, 1.5, 1] }),
      expect.objectContaining({ id: "partition-1", position: [2, 2, 0] }),
    ]);
  });

  it("does not add history when moving only locked partitions", () => {
    useMetaverseStudioStore.setState({
      items: [
        {
          ...createItem("partition-1", [2, 2, 0], "partition"),
          isLocked: true,
        },
      ],
      selectedItemId: "partition-1",
      selectedItemIds: ["partition-1"],
    });

    useMetaverseStudioStore.getState().moveSelectedItems([1, 0, 1]);

    expect(useMetaverseStudioStore.getState().items[0].position).toEqual([2, 2, 0]);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("preserves the existing room geometry when adding an exhibit", () => {
    useMetaverseStudioStore.setState({
      roomSize: {
        ...defaultGalleryScene.roomSize,
        width: 20,
        length: 20,
      },
      floorPlanElements: [{
        id: "legacy-rectangular-room",
        type: "room",
        position: [0, 0.02, 0],
        rotation: [0, 0, 0],
        scale: [9, 0.04, 50],
        color: "#dbeafe",
        isLocked: true,
      }],
    });

    useMetaverseStudioStore.getState().addItem("painting");

    expect(useMetaverseStudioStore.getState().floorPlanElements[0].scale).toEqual([9, 0.04, 50]);
  });

  it("enters floor-plan mode without creating an undo entry", () => {
    useMetaverseStudioStore.setState({ mode: "edit", undoStack: [], redoStack: [] });

    useMetaverseStudioStore.getState().setMode("floor-plan");

    expect(useMetaverseStudioStore.getState().mode).toBe("floor-plan");
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("creates a new wall inside the primary room", () => {
    useMetaverseStudioStore.setState({
      floorPlanElements: [{
        id: "primary-room",
        type: "room",
        position: [4, 0.02, 6],
        rotation: [0, 0, 0],
        scale: [12, 0.04, 10],
        color: "#dbeafe",
        isLocked: true,
      }],
    });

    useMetaverseStudioStore.getState().addFloorPlanElement("wall");

    const wall = useMetaverseStudioStore.getState().floorPlanElements.find((element) => element.type === "wall");
    expect(wall?.position).toEqual([4, 0.1, 6]);
  });

  it("does not add history when updating a missing item", () => {
    useMetaverseStudioStore.setState({
      items: [createItem("painting-1", [0, 1.5, 0])],
    });

    useMetaverseStudioStore.getState().updateItem("missing", { title: "Ignored" });

    expect(useMetaverseStudioStore.getState().items).toHaveLength(1);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("does not add history when item updates keep the same values", () => {
    useMetaverseStudioStore.setState({
      items: [
        {
          ...createItem("painting-1", [0, 1.5, 0]),
          title: "Same title",
        },
      ],
    });

    useMetaverseStudioStore.getState().updateItem("painting-1", {
      title: "Same title",
      position: [0, 1.5, 0],
    });

    expect(useMetaverseStudioStore.getState().items[0]).toEqual(
      expect.objectContaining({ title: "Same title", position: [0, 1.5, 0] }),
    );
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("does not add history when room size updates keep the same values", () => {
    const width = useMetaverseStudioStore.getState().roomSize.width;
    const wallColor = useMetaverseStudioStore.getState().roomSize.wallColor;

    useMetaverseStudioStore.getState().setRoomSize({ width, wallColor });

    expect(useMetaverseStudioStore.getState().roomSize).toEqual(
      expect.objectContaining({ width, wallColor }),
    );
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("does not add history when wall material updates keep the same values", () => {
    const wallColor = useMetaverseStudioStore.getState().roomSize.wallColor;
    const wallRoughness = useMetaverseStudioStore.getState().roomSize.wallRoughness;

    useMetaverseStudioStore.getState().setWallMaterialForTarget({
      wallColor,
      wallRoughness,
    });

    expect(useMetaverseStudioStore.getState().roomSize).toEqual(
      expect.objectContaining({ wallColor, wallRoughness }),
    );
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("locks all partitions in a single history entry", () => {
    useMetaverseStudioStore.setState({
      items: [
        createItem("painting-1", [0, 1.5, 0]),
        createItem("partition-1", [1, 2, 0], "partition"),
        {
          ...createItem("partition-2", [2, 2, 0], "partition"),
          isLocked: true,
        },
        createItem("partition-3", [3, 2, 0], "partition"),
      ],
      selectedItemId: "partition-1",
      selectedItemIds: ["partition-1", "partition-2", "partition-3"],
    });

    useMetaverseStudioStore.getState().setAllPartitionsLocked(true);

    const state = useMetaverseStudioStore.getState();
    expect(state.items.find((item) => item.id === "painting-1")?.isLocked).toBeUndefined();
    expect(state.items.filter((item) => item.type === "partition").every((item) => item.isLocked)).toBe(true);
    expect(state.undoStack).toHaveLength(1);
    expect(state.selectedItemIds).toEqual(["partition-1", "partition-2", "partition-3"]);
  });

  it("does not add history when all partitions already match the lock state", () => {
    useMetaverseStudioStore.setState({
      items: [
        {
          ...createItem("partition-1", [1, 2, 0], "partition"),
          isLocked: true,
        },
      ],
    });

    useMetaverseStudioStore.getState().setAllPartitionsLocked(true);

    expect(useMetaverseStudioStore.getState().items[0].isLocked).toBe(true);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("does not add history when changing all light strips without light strips", () => {
    useMetaverseStudioStore.setState({
      items: [createItem("painting-1", [0, 1.5, 0])],
    });

    useMetaverseStudioStore.getState().setAllLightStripsIntensity(0.8);

    expect(useMetaverseStudioStore.getState().items).toHaveLength(1);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("does not add history when all light strips already have the target intensity", () => {
    useMetaverseStudioStore.setState({
      items: [
        {
          ...createItem("light-1", [0, 2.8, 0], "lightstrip"),
          lightIntensity: 0.8,
        },
      ],
    });

    useMetaverseStudioStore.getState().setAllLightStripsIntensity(0.8);

    expect(useMetaverseStudioStore.getState().items[0].lightIntensity).toBe(0.8);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("changes all light strips in a single history entry", () => {
    useMetaverseStudioStore.setState({
      items: [
        {
          ...createItem("light-1", [0, 2.8, 0], "lightstrip"),
          lightIntensity: 0.4,
        },
        {
          ...createItem("light-2", [1, 2.8, 0], "lightstrip"),
          lightIntensity: 0.6,
        },
        createItem("painting-1", [0, 1.5, 0]),
      ],
    });

    useMetaverseStudioStore.getState().setAllLightStripsIntensity(0.9);

    const state = useMetaverseStudioStore.getState();
    expect(state.items.filter((item) => item.type === "lightstrip").every((item) => item.lightIntensity === 0.9)).toBe(true);
    expect(state.items.find((item) => item.id === "painting-1")?.lightIntensity).toBeUndefined();
    expect(state.undoStack).toHaveLength(1);
  });

  it("does not add history when changing all painting frames without paintings", () => {
    useMetaverseStudioStore.setState({
      items: [createItem("light-1", [0, 2.8, 0], "lightstrip")],
    });

    useMetaverseStudioStore.getState().setAllPaintingFrameSize(2, 1.5);

    expect(useMetaverseStudioStore.getState().items).toHaveLength(1);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("does not remove locked partitions during multi-selection deletes", () => {
    useMetaverseStudioStore.setState({
      items: [
        createItem("painting-1", [0, 1.5, 0]),
        {
          ...createItem("partition-1", [2, 2, 0], "partition"),
          isLocked: true,
        },
      ],
      selectedItemId: "painting-1",
      selectedItemIds: ["painting-1", "partition-1"],
    });

    useMetaverseStudioStore.getState().removeSelectedItems();

    expect(useMetaverseStudioStore.getState().items).toEqual([
      expect.objectContaining({ id: "partition-1" }),
    ]);
    expect(useMetaverseStudioStore.getState().selectedItemIds).toEqual(["partition-1"]);
    expect(useMetaverseStudioStore.getState().selectedItemId).toBe("partition-1");
  });

  it("does not duplicate a locked partition directly", () => {
    useMetaverseStudioStore.setState({
      items: [
        {
          ...createItem("partition-1", [2, 2, 0], "partition"),
          isLocked: true,
        },
      ],
      selectedItemId: "partition-1",
      selectedItemIds: ["partition-1"],
    });

    useMetaverseStudioStore.getState().duplicateItem("partition-1");

    expect(useMetaverseStudioStore.getState().items).toHaveLength(1);
    expect(useMetaverseStudioStore.getState().undoStack).toHaveLength(0);
  });

  it("skips locked partitions during multi-selection duplication", () => {
    useMetaverseStudioStore.setState({
      items: [
        createItem("painting-1", [0, 1.5, 0]),
        {
          ...createItem("partition-1", [2, 2, 0], "partition"),
          isLocked: true,
        },
      ],
      selectedItemId: "painting-1",
      selectedItemIds: ["painting-1", "partition-1"],
    });

    useMetaverseStudioStore.getState().duplicateSelectedItems();

    const state = useMetaverseStudioStore.getState();
    expect(state.items).toHaveLength(3);
    expect(state.items.filter((item) => item.type === "partition")).toHaveLength(1);
    expect(state.items.filter((item) => item.type === "painting")).toHaveLength(2);
    expect(state.selectedItemIds).toHaveLength(1);
    expect(state.selectedItemIds[0]).not.toBe("partition-1");
  });
});
