import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import { Move, MoveHorizontal } from "lucide-react";
import { clampJoystick, type PlayerInputState } from "../input/playerInput";
import { useTouchControls } from "../input/useTouchControls";
import { useI18n } from "../../../components/I18nProvider";
import type { ItemInteractionDescriptor } from "../interaction/itemInteraction";

type MobileControlsProps = {
  input: MutableRefObject<PlayerInputState>;
  nearbyInteraction: ItemInteractionDescriptor | null;
};
const JOYSTICK_RADIUS = 40;
const DEAD_ZONE = 0.1;

export function MobileControls(props: MobileControlsProps) {
  return useTouchControls() ? <TouchControls {...props} /> : null;
}

function TouchControls({ input, nearbyInteraction }: MobileControlsProps) {
  const { t } = useI18n();
  const movePointer = useRef<number | null>(null);
  const lookPointer = useRef<number | null>(null);
  const joystickOrigin = useRef({ x: 0, y: 0 });
  const lastLookPoint = useRef({ x: 0, y: 0 });
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const clearInput = () => {
      movePointer.current = null;
      lookPointer.current = null;
      input.current.moveX = 0;
      input.current.moveY = 0;
      input.current.lookDeltaX = 0;
      input.current.lookDeltaY = 0;
      input.current.interactRequested = false;
    };
    const stop = () => { clearInput(); setThumb({ x: 0, y: 0 }); };
    const onVisibilityChange = () => { if (document.hidden) stop(); };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInput();
    };
  }, [input]);

  const updateJoystick = (event: PointerEvent<HTMLDivElement>) => {
    const next = clampJoystick(event.clientX - joystickOrigin.current.x, event.clientY - joystickOrigin.current.y, JOYSTICK_RADIUS);
    const magnitude = Math.hypot(next.x, next.y);
    // Ignore resting-finger drift, then ramp smoothly up to full speed.
    const speed = magnitude <= DEAD_ZONE ? 0 : (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE);
    input.current.moveX = magnitude ? next.x / magnitude * speed : 0;
    input.current.moveY = magnitude ? -next.y / magnitude * speed : 0;
    setThumb({ x: next.x * JOYSTICK_RADIUS, y: next.y * JOYSTICK_RADIUS });
  };
  const stopMoving = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== movePointer.current) return;
    movePointer.current = null;
    input.current.moveX = 0;
    input.current.moveY = 0;
    setThumb({ x: 0, y: 0 });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const stopLooking = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== lookPointer.current) return;
    lookPointer.current = null;
    input.current.lookDeltaX = 0;
    input.current.lookDeltaY = 0;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <div
        aria-label={t("mobileLookControl")}
        className="pointer-events-auto absolute inset-y-0 right-0 w-1/2 touch-none"
        onPointerDown={(event) => {
          if (lookPointer.current !== null || event.button !== 0) return;
          event.preventDefault();
          lookPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          lastLookPoint.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (lookPointer.current !== event.pointerId) return;
          input.current.lookDeltaX += event.clientX - lastLookPoint.current.x;
          input.current.lookDeltaY += event.clientY - lastLookPoint.current.y;
          lastLookPoint.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={stopLooking}
        onPointerCancel={stopLooking}
        onLostPointerCapture={stopLooking}
      >
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-slate-950/55 px-3 py-2 text-xs text-white/85">
          <MoveHorizontal className="size-4" aria-hidden="true" />{t("mobileLookHint")}
        </div>
      </div>
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] flex flex-col items-center gap-2">
        <div
          aria-label={t("mobileMoveControl")}
          className="pointer-events-auto relative size-32 touch-none rounded-full border border-white/40 bg-slate-950/50 shadow-lg backdrop-blur-sm"
          onPointerDown={(event) => {
            if (movePointer.current !== null || event.button !== 0) return;
            event.preventDefault();
            movePointer.current = event.pointerId;
            const bounds = event.currentTarget.getBoundingClientRect();
            joystickOrigin.current = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
            event.currentTarget.setPointerCapture(event.pointerId);
            updateJoystick(event);
          }}
          onPointerMove={(event) => { if (movePointer.current === event.pointerId) updateJoystick(event); }}
          onPointerUp={stopMoving}
          onPointerCancel={stopMoving}
          onLostPointerCapture={stopMoving}
        >
          <span aria-hidden="true" className="absolute inset-4 rounded-full border border-white/15" />
          <span
            aria-hidden="true"
            data-testid="mobile-joystick-thumb"
            className="absolute left-1/2 top-1/2 flex size-12 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-800 shadow-lg"
            style={{ transform: `translate(-50%, -50%) translate(${thumb.x}px, ${thumb.y}px)` }}
          ><Move className="size-6" /></span>
        </div>
        <span className="rounded-full bg-slate-950/60 px-2.5 py-1 text-xs text-white">{t("mobileMoveHint")}</span>
      </div>
      {nearbyInteraction && (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] min-h-12 max-w-[calc(50%-1rem)] rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-xl"
          onClick={() => { input.current.interactRequested = true; }}
        >{nearbyInteraction.prompt}</button>
      )}
    </div>
  );
}
