export interface PlayerInputState {
  moveX: number;
  moveY: number;
  lookDeltaX: number;
  lookDeltaY: number;
  interactRequested: boolean;
  pressedKeys: Set<string>;
}

export function createPlayerInputState(): PlayerInputState {
  return {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    interactRequested: false,
    pressedKeys: new Set(),
  };
}

export function clampJoystick(x: number, y: number, radius: number) {
  const length = Math.hypot(x, y);
  if (length === 0 || radius <= 0) return { x: 0, y: 0 };

  const scale = Math.min(1, radius / length) / radius;
  return { x: x * scale, y: y * scale };
}

export function setKeyboardKey(
  state: PlayerInputState,
  code: string,
  pressed: boolean,
) {
  const wasPressed = state.pressedKeys.has(code);
  if (code === "KeyE" && pressed && !wasPressed) {
    state.interactRequested = true;
  }

  if (pressed) state.pressedKeys.add(code);
  else state.pressedKeys.delete(code);

  const x =
    Number(
      state.pressedKeys.has("KeyD") ||
        state.pressedKeys.has("ArrowRight"),
    ) -
    Number(
      state.pressedKeys.has("KeyA") ||
        state.pressedKeys.has("ArrowLeft"),
    );
  const y =
    Number(
      state.pressedKeys.has("KeyW") ||
        state.pressedKeys.has("ArrowUp"),
    ) -
    Number(
      state.pressedKeys.has("KeyS") ||
        state.pressedKeys.has("ArrowDown"),
    );
  const length = Math.hypot(x, y) || 1;

  state.moveX = x / length;
  state.moveY = y / length;
}
