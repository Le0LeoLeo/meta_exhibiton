import { useEffect, type MutableRefObject } from 'react';
import { setKeyboardKey, type PlayerInputState } from './playerInput';
import { isTypingTarget } from './isTypingTarget';

export function usePlayerKeyboardInput(input: MutableRefObject<PlayerInputState>, enabled: boolean) {
  useEffect(() => {
    const reset = () => {
      input.current.pressedKeys.clear();
      input.current.moveX = 0;
      input.current.moveY = 0;
      input.current.lookDeltaX = 0;
      input.current.lookDeltaY = 0;
      input.current.interactRequested = false;
    };
    reset();
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      setKeyboardKey(input.current, event.code, true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      // A key released after focusing a text field must not remain held.
      setKeyboardKey(input.current, event.code, false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isTypingTarget(event.target)) reset();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('blur', reset);
      reset();
    };
  }, [enabled, input]);
}
