import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSceneLifecycle } from "./useSceneLifecycle";

function setDocumentVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useSceneLifecycle", () => {
  it("allows motion only when the document is visible and no detail is open", () => {
    setDocumentVisibility("visible");

    const { result, rerender } = renderHook(
      ({ detailOpen }: { detailOpen: boolean }) =>
        useSceneLifecycle({ detailOpen }),
      { initialProps: { detailOpen: false } },
    );

    expect(result.current).toEqual({
      visible: true,
      detailOpen: false,
      obscured: false,
      allowMotion: true,
    });

    rerender({ detailOpen: true });

    expect(result.current.obscured).toBe(true);
    expect(result.current.allowMotion).toBe(false);

    rerender({ detailOpen: false });
    act(() => setDocumentVisibility("hidden"));

    expect(result.current.visible).toBe(false);
    expect(result.current.obscured).toBe(true);
    expect(result.current.allowMotion).toBe(false);
  });
});
