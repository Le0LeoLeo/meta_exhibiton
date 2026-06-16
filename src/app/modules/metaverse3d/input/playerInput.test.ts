import { describe, expect, it } from "vitest";

import {
  clampJoystick,
  createPlayerInputState,
  setKeyboardKey,
} from "./playerInput";

describe("player input", () => {
  it("normalizes diagonal keyboard movement", () => {
    const state = createPlayerInputState();

    setKeyboardKey(state, "KeyW", true);
    setKeyboardKey(state, "KeyD", true);

    expect(Math.hypot(state.moveX, state.moveY)).toBeCloseTo(1);
    expect(state.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(state.moveY).toBeCloseTo(Math.SQRT1_2);
  });

  it("clamps joystick travel to the unit circle", () => {
    expect(clampJoystick(80, 80, 60)).toEqual({
      x: expect.closeTo(Math.SQRT1_2),
      y: expect.closeTo(Math.SQRT1_2),
    });
  });
});
