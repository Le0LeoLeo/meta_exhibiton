import { beforeEach, describe, expect, it } from "vitest";

import {
  isRuntimeItemActive,
  useRuntimeInteractionStore,
} from "./runtimeInteractionStore";

describe("runtime interaction store", () => {
  beforeEach(() => {
    useRuntimeInteractionStore.getState().reset();
  });

  it("uses the supplied default until an item has runtime state", () => {
    expect(isRuntimeItemActive({}, "light-1", true)).toBe(true);
    expect(isRuntimeItemActive({}, "cabinet-1", false)).toBe(false);
  });

  it("toggles from each item's default without writing scene state", () => {
    const store = useRuntimeInteractionStore.getState();

    store.toggleItem("light-1", true);
    store.toggleItem("cabinet-1", false);

    expect(useRuntimeInteractionStore.getState().activeByItemId).toEqual({
      "light-1": false,
      "cabinet-1": true,
    });
  });

  it("tracks the current seat independently of active item state", () => {
    const store = useRuntimeInteractionStore.getState();
    store.setItemActive("fountain-1", true);
    store.setSeatedItemId("bench-1");

    expect(useRuntimeInteractionStore.getState()).toMatchObject({
      activeByItemId: { "fountain-1": true },
      seatedItemId: "bench-1",
    });
  });
});
