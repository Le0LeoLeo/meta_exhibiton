import {
  useEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent,
} from "react";

import {
  clampJoystick,
  type PlayerInputState,
} from "../input/playerInput";
import { useI18n } from "../../../components/I18nProvider";

export function MobileControls({
  input,
  nearbyItemTitle,
}: {
  input: MutableRefObject<PlayerInputState>;
  nearbyItemTitle: string | null;
}) {
  const { t } = useI18n();
  const joystickOrigin = useRef({ x: 0, y: 0 });
  const lastLookPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      input.current.moveX = 0;
      input.current.moveY = 0;
      input.current.lookDeltaX = 0;
      input.current.lookDeltaY = 0;
    };
  }, [input]);

  if (
    typeof window === "undefined" ||
    !(window.matchMedia?.("(pointer: coarse)").matches ?? false)
  ) {
    return null;
  }

  const updateJoystick = (event: PointerEvent<HTMLDivElement>) => {
    const next = clampJoystick(
      event.clientX - joystickOrigin.current.x,
      event.clientY - joystickOrigin.current.y,
      56,
    );
    input.current.moveX = next.x;
    input.current.moveY = -next.y;
  };

  const resetJoystick = () => {
    input.current.moveX = 0;
    input.current.moveY = 0;
  };

  const resetLook = () => {
    lastLookPoint.current = null;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        aria-label={t("mobileMoveControl")}
        className="pointer-events-auto absolute bottom-6 left-6 size-28 touch-none rounded-full border border-white/30 bg-slate-950/40"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          joystickOrigin.current = {
            x: event.clientX,
            y: event.clientY,
          };
          updateJoystick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            updateJoystick(event);
          }
        }}
        onPointerUp={resetJoystick}
        onPointerCancel={resetJoystick}
      />
      <div
        aria-label={t("mobileLookControl")}
        className="pointer-events-auto absolute inset-y-0 right-0 w-1/2 touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          lastLookPoint.current = {
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerMove={(event) => {
          const previous = lastLookPoint.current;
          if (
            !previous ||
            !event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            return;
          }
          input.current.lookDeltaX += event.clientX - previous.x;
          input.current.lookDeltaY += event.clientY - previous.y;
          lastLookPoint.current = {
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerUp={resetLook}
        onPointerCancel={resetLook}
      />
      {nearbyItemTitle && (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-8 left-1/2 min-h-11 -translate-x-1/2 rounded-full bg-white px-5 text-sm font-medium text-slate-950 shadow-xl"
          onClick={() => {
            input.current.interactRequested = true;
          }}
        >
          {t("mobileViewItem", { title: nearbyItemTitle })}
        </button>
      )}
    </div>
  );
}
