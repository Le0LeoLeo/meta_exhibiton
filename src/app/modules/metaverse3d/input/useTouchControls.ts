import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse), (max-width: 767px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia?.(QUERY).matches ?? false;
}

// Narrow windows expose phone controls; hybrid touch devices keep them too.
export function useTouchControls() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
