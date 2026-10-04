import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ExhibitItem } from "../types";
import { defaultGalleryScene } from "./defaultGalleryScene";
import { useMetaverseStudioStore } from "./useMetaverseStudioStore";
import { VEHICLE_PLATFORM_URL } from '../items/templateDisplay';
import type { AddItemOptions } from './metaverseStoreTypes';

const createItem = (id: string, position: [number, number, number], type: ExhibitItem["type"] = "painting"): ExhibitItem => ({
  id,
  type,
  position,
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  content: "",
});

describe("useMetaverseStudioStore composed agent and selection actions", () => {
  beforeEach(() => {
    useMetaverseStudioStore.setState(useMetaverseStudioStore.getInitialState(), true);
    useMetaverseStudioStore.setState({
      items: [createItem("painting-1", [0, 1.5, 0]), createItem("painting-2", [2, 1.5, 0]), createItem("text-1", [0, 2, 0], "text")],
      undoStack: [],
      redoStack: [],
    });
  });

  it("keeps one-time focus through ordinary updates but clears it for a new agent session", () => {
    const store = useMetaverseStudioStore;
    const sessionId = store.getState().agent.memory.sessionId;
    store.getState().focusAgentOnExhibitOnce("painting-1");
    store.getState().setAgent({ enabled: true, memory: { ...store.getState().agent.memory, sessionId } });
    expect(store.getState().oneTimeExhibitFocus).toEqual({ sessionId, itemId: "painting-1" });

    store.getState().setAgent({ memory: { ...store.getState().agent.memory, sessionId: "next-session" } });
    expect(store.getState().oneTimeExhibitFocus).toBeNull();
  });

  it.each(["setAgent", "closeAgentChat"] as const)("clears one-time focus when closing chat with %s", (action) => {
    const store = useMetaverseStudioStore;
    store.getState().focusAgentOnExhibitOnce("painting-1");
    store.getState().openAgentChat();
    expect(store.getState().agent).toMatchObject({ isChatOpen: true, enabled: true });
    expect(store.getState().oneTimeExhibitFocus?.itemId).toBe("painting-1");

    if (action === "setAgent") store.getState().setAgent({ isChatOpen: false });
    else store.getState().closeAgentChat();
    expect(store.getState().agent.isChatOpen).toBe(false);
    expect(store.getState().oneTimeExhibitFocus).toBeNull();
  });

  it("preserves one-time focus through ending a tour and clears it on scene import", () => {
    const store = useMetaverseStudioStore;
    store.getState().focusAgentOnExhibitOnce("painting-1");
    store.getState().startAgentTour(["painting-1"]);
    store.getState().endAgentTour();
    expect(store.getState().oneTimeExhibitFocus?.itemId).toBe("painting-1");

    store.getState().importScene(store.getState().exportScene());
    expect(store.getState().oneTimeExhibitFocus).toBeNull();
  });

  it("keeps agent dialogue and bounded chat history in the live store", () => {
    const store = useMetaverseStudioStore;
    store.getState().setAgentDialogue("First explanation");
    store.getState().setAgentCurrentDialogue("First explanation");
    expect(store.getState().agentChat).toHaveLength(1);
    for (let index = 0; index < 22; index += 1) {
      store.getState().pushAgentMessage({ role: "user", content: `Question ${index}` });
    }
    expect(store.getState().agent.currentDialogue).toBe("First explanation");
    expect(store.getState().agentChat).toHaveLength(20);
    expect(store.getState().agentChat[0].content).toBe("Question 2");
    expect(new Set(store.getState().agentChat.map(message => message.id)).size).toBe(20);
  });

  it("selects by exhibit type and clears selection for a missing exhibit", () => {
    const store = useMetaverseStudioStore;
    store.getState().setSelectedItemId("painting-1");
    store.getState().toggleMultiSelectItem("painting-2");
    expect(store.getState().selectedItemIds).toEqual(["painting-1", "painting-2"]);
    expect(store.getState().selectedItemId).toBe("painting-2");

    store.getState().toggleMultiSelectItem("text-1");
    expect(store.getState().selectedItemIds).toEqual(["text-1"]);
    store.getState().toggleMultiSelectItem("missing");
    expect(store.getState().selectedItemIds).toEqual([]);
    expect(store.getState().selectedItemId).toBeNull();

    store.getState().setSelectedItemId("painting-1");
    store.getState().clearSelectedItems();
    expect(store.getState().selectedItemIds).toEqual([]);
    expect(store.getState().selectedItemId).toBeNull();
    expect(store.getState().undoStack).toEqual([]);
  });

  it("removes the primary selection while preserving surviving selections and history", () => {
    const store = useMetaverseStudioStore;
    store.getState().setSelectedItemId("painting-1");
    store.getState().toggleMultiSelectItem("painting-2");
    store.getState().removeItem("painting-2");
    expect(store.getState().selectedItemId).toBeNull();
    expect(store.getState().selectedItemIds).toEqual(["painting-1"]);
    expect(store.getState().items.map(item => item.id)).toEqual(["painting-1", "text-1"]);
    expect(store.getState().undoStack).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().items.map(item => item.id)).toEqual(["painting-1", "painting-2", "text-1"]);
  });

  it("keeps agent and selection state outside scene persistence and scene history", () => {
    const store = useMetaverseStudioStore;
    const scene = store.getState().exportScene();
    store.getState().openAgentChat();
    store.getState().focusAgentOnExhibitOnce("painting-1");
    store.getState().setSelectedItemId("painting-1");
    store.getState().setAgentFollowUser(true);
    store.getState().startAgentTour(["painting-1", "painting-2"]);
    store.getState().trackAgentDwell("painting-1", 3);

    const options = store.persist.getOptions();
    const persisted = options.partialize?.(store.getState());
    expect(options).toMatchObject({ name: "metaverse-exhibition-storage", version: 7 });
    expect(Object.keys(persisted ?? {}).sort()).toEqual(["floorPlanElements", "items", "performanceMode", "roomSize", "wallMaterialOverrides"]);
    expect(store.getState().exportScene()).toEqual(scene);
    expect(store.getState().undoStack).toEqual([]);
    expect(store.getState().redoStack).toEqual([]);
  });
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

  it('keeps an added platform preset through undo, redo and scene serialization without sharing placement arrays', () => {
    const options: AddItemOptions = {
      position: [2, 0, 3], rotation: [0, 0.5, 0], scale: [1, 1, 1],
      content: VEHICLE_PLATFORM_URL, modelOffset: [0, 0, 0], title: '長方形展台',
    };
    useMetaverseStudioStore.getState().addItem('pedestal', options);
    const item = useMetaverseStudioStore.getState().items[0];
    expect(item).toMatchObject({ type: 'pedestal', ...options });
    expect(item.position).not.toBe(options.position);
    expect(item.rotation).not.toBe(options.rotation);
    expect(item.scale).not.toBe(options.scale);
    expect(item.modelOffset).not.toBe(options.modelOffset);
    useMetaverseStudioStore.getState().undo();
    expect(useMetaverseStudioStore.getState().items).toHaveLength(0);
    useMetaverseStudioStore.getState().redo();
    expect(useMetaverseStudioStore.getState().items).toEqual([item]);
    const saved = JSON.parse(JSON.stringify(useMetaverseStudioStore.getState().exportScene()));
    useMetaverseStudioStore.setState({ items: [] });
    useMetaverseStudioStore.getState().importScene(saved);
    expect(useMetaverseStudioStore.getState().items).toEqual([item]);
    useMetaverseStudioStore.getState().addItem('pedestal');
    expect(useMetaverseStudioStore.getState().items[1].content).not.toBe(VEHICLE_PLATFORM_URL);
    expect(useMetaverseStudioStore.getState().items[1].modelOffset).toBeUndefined();
  });

  it('leaves the scene and both history stacks unchanged when viewing', () => {
    const store = useMetaverseStudioStore.getState();
    const before = store.exportScene();
    const after = { ...before, items: [createItem('new-art', [0, 1, 0])] };
    useMetaverseStudioStore.setState({ mode: 'view', undoStack: [before], redoStack: [after] });
    const undoStack = useMetaverseStudioStore.getState().undoStack;
    const redoStack = useMetaverseStudioStore.getState().redoStack;
    store.undo();
    store.redo();
    expect(store.exportScene()).toEqual(before);
    expect(useMetaverseStudioStore.getState().undoStack).toBe(undoStack);
    expect(useMetaverseStudioStore.getState().redoStack).toBe(redoStack);
    store.setMode('edit');
    store.redo();
    expect(store.exportScene()).toEqual(after);
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

  it("applies one frame appearance to every painting in a single history entry", () => {
    useMetaverseStudioStore.setState({
      items: [
        createItem("painting-1", [0, 1.5, 0]),
        createItem("painting-2", [2, 1.5, 0]),
        createItem("light-1", [0, 2.8, 0], "lightstrip"),
      ],
    });

    useMetaverseStudioStore.getState().setAllPaintingFrameAppearance({
      frameStyle: "natural",
      frameColor: "#8b5e3c",
      frameInnerColor: "#d6aa72",
      frameThickness: 0.11,
      frameDepth: 0.09,
      frameMatEnabled: true,
      frameMatColor: "#f5f0e5",
      frameMatWidth: 0.12,
      frameGlassEnabled: false,
    });

    const state = useMetaverseStudioStore.getState();
    expect(
      state.items
        .filter((item) => item.type === "painting")
        .every((item) => item.frameStyle === "natural" && item.frameMatEnabled),
    ).toBe(true);
    expect(state.items.find((item) => item.type === "lightstrip")?.frameStyle).toBeUndefined();
    expect(state.undoStack).toHaveLength(1);
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

describe("useMetaverseStudioStore new item defaults", () => {
  const originalLang = document.documentElement.lang;

  beforeEach(() => {
    useMetaverseStudioStore.setState(useMetaverseStudioStore.getInitialState(), true);
    useMetaverseStudioStore.setState({ items: [], undoStack: [], redoStack: [] });
  });

  afterEach(() => { document.documentElement.lang = originalLang; });

  it("keeps the user's new item selected when a companion light strip is added", () => {
    const store = useMetaverseStudioStore.getState();
    store.addItem("text");
    const textId = useMetaverseStudioStore.getState().selectedItemId;
    store.addItem("lightstrip", { select: false });

    const state = useMetaverseStudioStore.getState();
    expect(state.items).toHaveLength(2);
    expect(state.selectedItemId).toBe(textId);
    expect(state.selectedItemIds).toEqual([textId]);
  });

  it("uses the interface language for placeholder text and leaves artwork filler empty", () => {
    document.documentElement.lang = "en";
    const store = useMetaverseStudioStore.getState();
    store.addItem("text");
    store.addItem("painting");

    const [text, painting] = useMetaverseStudioStore.getState().items;
    expect(text.content).toBe("Exhibition text");
    expect(painting.title).toBe("New artwork");
    expect(painting.artist).toBe("");
    expect(painting.description).toBe("");
  });
});
