import { afterEach, describe, expect, it } from "vitest";

import { useMultiplayerStore } from "./multiplayerStore";

const initialState = useMultiplayerStore.getState();

afterEach(() => {
  useMultiplayerStore.setState(initialState, true);
});

describe("multiplayer scene operation queue", () => {
  it("preserves operations received before the editor has applied the first one", () => {
    const store = useMultiplayerStore.getState();
    store.setSceneOpPayload({
      roomId: "gallery-1",
      by: "editor-1",
      clientOpId: "first",
      op: { kind: "remove-item", id: "item-1" },
      updatedAt: 1,
    });
    store.setSceneOpPayload({
      roomId: "gallery-1",
      by: "editor-2",
      clientOpId: "second",
      op: { kind: "remove-item", id: "item-2" },
      updatedAt: 2,
    });

    expect(useMultiplayerStore.getState().sceneOpPayloads.map((payload) => payload.clientOpId))
      .toEqual(["first", "second"]);

    useMultiplayerStore.getState().dequeueSceneOpPayload("first");

    expect(useMultiplayerStore.getState().sceneOpPayloads.map((payload) => payload.clientOpId))
      .toEqual(["second"]);
  });
});
