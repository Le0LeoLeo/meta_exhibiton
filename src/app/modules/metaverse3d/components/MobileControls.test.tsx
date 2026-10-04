import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileControls } from "./MobileControls";
import { createPlayerInputState } from "../input/playerInput";

vi.mock("../../../components/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

let matches = true;
let mediaChanged: () => void;
beforeEach(() => {
  matches = true;
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    addEventListener: (_: string, callback: () => void) => { mediaChanged = callback; },
    removeEventListener: vi.fn(),
  })));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 16, y: 600, left: 16, top: 600, width: 128, height: 128, right: 144, bottom: 728, toJSON() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount() {
  const input = { current: createPlayerInputState() };
  const result = render(<MobileControls input={input} nearbyInteraction={{ id: 'art', title: 'Art', prompt: 'View artwork', kind: 'view', defaultActive: false }} />);
  const move = screen.getByLabelText("mobileMoveControl");
  const look = screen.getByLabelText("mobileLookControl");
  for (const el of [move, look]) {
    const captured = new Set<number>();
    el.setPointerCapture = (id) => { captured.add(id); };
    el.hasPointerCapture = (id) => captured.has(id);
    el.releasePointerCapture = (id) => { captured.delete(id); };
  }
  return { ...result, input, move, look };
}

describe("mobile exhibition controls", () => {
  it("uses a dead zone and clamps diagonal movement and the visible thumb", () => {
    const { input, move } = mount();
    fireEvent.pointerDown(move, { pointerId: 1, clientX: 80, clientY: 664 });
    fireEvent.pointerMove(move, { pointerId: 1, clientX: 82, clientY: 664 });
    expect(input.current.moveX).toBe(0);
    fireEvent.pointerMove(move, { pointerId: 1, clientX: 160, clientY: 584 });
    expect(input.current.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(input.current.moveY).toBeCloseTo(Math.SQRT1_2);
    expect(screen.getByTestId("mobile-joystick-thumb").style.transform).not.toContain("translate(0px, 0px)");
    fireEvent.pointerUp(move, { pointerId: 1 });
    expect(input.current.moveX).toBe(0);
    expect(input.current.moveY).toBe(0);
    expect(screen.getByTestId("mobile-joystick-thumb").style.transform).toContain("translate(0px, 0px)");
  });

  it("lets two fingers move and look independently without extra pointers taking over", () => {
    const { input, move, look } = mount();
    fireEvent.pointerDown(move, { pointerId: 1, clientX: 80, clientY: 624 });
    fireEvent.pointerDown(look, { pointerId: 2, clientX: 260, clientY: 300 });
    fireEvent.pointerMove(look, { pointerId: 2, clientX: 285, clientY: 290 });
    expect(input.current).toMatchObject({ moveY: 1, lookDeltaX: 25, lookDeltaY: -10 });
    fireEvent.pointerDown(move, { pointerId: 3, clientX: 16, clientY: 664 });
    fireEvent.pointerMove(move, { pointerId: 3, clientX: 200, clientY: 664 });
    fireEvent.pointerUp(move, { pointerId: 3 });
    fireEvent.pointerDown(look, { pointerId: 4, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(look, { pointerId: 4, clientX: 500, clientY: 500 });
    fireEvent.pointerUp(look, { pointerId: 4 });
    expect(input.current).toMatchObject({ moveY: 1, moveX: 0, lookDeltaX: 25, lookDeltaY: -10 });
    fireEvent.pointerUp(look, { pointerId: 2 });
    expect(input.current).toMatchObject({ moveY: 1, lookDeltaX: 0, lookDeltaY: 0 });
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)("stops after %s and ignores stale moves", (event) => {
    const { input, move, look } = mount();
    fireEvent.pointerDown(move, { pointerId: 1, clientX: 120, clientY: 664 });
    fireEvent.pointerDown(look, { pointerId: 2, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(look, { pointerId: 2, clientX: 270, clientY: 300 });
    fireEvent[event](move, { pointerId: 1 });
    fireEvent[event](look, { pointerId: 2 });
    fireEvent.pointerMove(move, { pointerId: 1, clientX: 120, clientY: 664 });
    fireEvent.pointerMove(look, { pointerId: 2, clientX: 300, clientY: 300 });
    expect(input.current).toMatchObject({ moveX: 0, moveY: 0, lookDeltaX: 0, lookDeltaY: 0 });
  });

  it.each(["blur", "hidden", "unmount", "resize"] as const)("clears input on %s", (reason) => {
    const { input, move, look, unmount } = mount();
    fireEvent.pointerDown(move, { pointerId: 1, clientX: 80, clientY: 624 });
    fireEvent.pointerDown(look, { pointerId: 2, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(look, { pointerId: 2, clientX: 270, clientY: 300 });
    fireEvent.click(screen.getByRole("button", { name: "View artwork" }));
    expect(input.current.interactRequested).toBe(true);
    if (reason === "blur") fireEvent.blur(window);
    if (reason === "hidden") {
      vi.spyOn(document, "hidden", "get").mockReturnValue(true);
      fireEvent(document, new Event("visibilitychange"));
    }
    if (reason === "unmount") unmount();
    if (reason === "resize") act(() => { matches = false; mediaChanged(); });
    expect(input.current).toMatchObject({ moveX: 0, moveY: 0, lookDeltaX: 0, lookDeltaY: 0, interactRequested: false });
    fireEvent.pointerMove(move, { pointerId: 1, clientX: 80, clientY: 624 });
    expect(input.current.moveY).toBe(0);
  });
});
