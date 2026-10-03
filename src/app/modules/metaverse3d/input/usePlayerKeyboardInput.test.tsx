import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlayerInputState } from './playerInput';
import { usePlayerKeyboardInput } from './usePlayerKeyboardInput';

afterEach(() => { cleanup(); document.body.replaceChildren(); });

describe('player keyboard input', () => {
  it.each(['input', 'textarea', 'select', 'contenteditable'])('ignores movement and interaction while typing in %s', (tag) => {
    const input = { current: createPlayerInputState() };
    renderHook(() => usePlayerKeyboardInput(input, true));
    const field = document.createElement(tag === 'contenteditable' ? 'div' : tag);
    if (tag === 'contenteditable') field.setAttribute('contenteditable', 'true');
    document.body.append(field);
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'ArrowRight']) fireEvent.keyDown(field, { code });
    expect(input.current.moveX).toBe(0);
    expect(input.current.moveY).toBe(0);
    expect(input.current.interactRequested).toBe(false);
  });

  it('resets held controls on focus, blur, disabling, and unmount', () => {
    const input = { current: createPlayerInputState() };
    const view = renderHook(({ enabled }) => usePlayerKeyboardInput(input, enabled), { initialProps: { enabled: true } });
    fireEvent.keyDown(window, { code: 'KeyW' });
    expect(input.current.moveY).toBe(1);
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.focusIn(field);
    expect(input.current.moveY).toBe(0);
    fireEvent.keyDown(window, { code: 'KeyD' });
    fireEvent.keyUp(field, { code: 'KeyD' });
    expect(input.current.moveX).toBe(0);
    fireEvent.keyDown(window, { code: 'KeyW' });
    fireEvent.blur(window);
    expect(input.current.pressedKeys.size).toBe(0);
    fireEvent.keyDown(window, { code: 'KeyE' });
    view.rerender({ enabled: false });
    expect(input.current.interactRequested).toBe(false);
    fireEvent.keyDown(window, { code: 'KeyW' });
    expect(input.current.moveY).toBe(0);
    view.rerender({ enabled: true });
    fireEvent.keyDown(window, { code: 'KeyW' });
    view.unmount();
    expect(input.current.moveY).toBe(0);
  });
});
