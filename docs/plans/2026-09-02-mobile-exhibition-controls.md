# Mobile Exhibition Controls Implementation Plan

**Goal:** Make phone exhibition visits usable with a visible movement joystick, independent look gestures, and reachable dialogs.

**Architecture:** Reuse the shared player input ref and existing viewer pause conditions. Use independent pointer ownership and responsive input detection. Bound entry and chat panels to the viewport, keeping primary controls outside scrolling content.

**Tech Stack:** React 18, Pointer Events, Tailwind, Zustand, Vitest, Testing Library.

1. Add responsive detection and a visible joystick. Test simultaneous pointers, cancellation, blur, unmount, and interaction requests.
2. Make mobile emotes reachable, replace keyboard-only hints, bound entry/chat panels, and keep navigation below overlays. Test entry defaults and existing chat/viewer behavior.
3. Run focused tests and type checking. Inspect real exhibition pages at phone widths and exercise movement and dialogs. Record device-only verification limits.

## Landscape viewing follow-up

- Enter mobile 3D viewing from the participation confirmation gesture. Request fullscreen on the document root so exit and 2D navigation stay available, then request a landscape orientation lock.
- Detect coarse-pointer devices and the lock API at runtime. Unsupported or rejected requests fall back to a dismissible manual rotation hint; portrait viewing remains usable.
- Release only the orientation lock and fullscreen session requested by this visit on mode change or unmount. Handle pending requests, repeated taps and user exits from fullscreen.
- Verify with hook/component tests for lifecycle and browser rejection paths, TypeScript, ESLint and production build. Physical device orientation behavior still requires iOS/Android testing.

## Mobile editing restriction follow-up

- Detect mobile/tablet devices independently of viewport width, including mobile devices with a mouse attached. Keep desktop editing available in narrow windows.
- Prevent edit/floor-plan transitions in the studio store. Guard the studio render before loading an editing canvas or editor panels, including stale state.
- Block direct editing URLs before loading or saving scenes. Keep viewing links accessible, render mobile editor shares in view mode and disable their persistence.
- Replace or disable editor entry points with view-only/desktop guidance. Preserve the separate quick exhibition upload workflow.
- Test device detection, store restrictions, editor route blocking, shared-view persistence, normal desktop editing and existing viewing behavior.
