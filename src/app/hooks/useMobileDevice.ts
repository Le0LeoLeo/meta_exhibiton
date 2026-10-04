import { useSyncExternalStore } from "react";
import { isMobileDevice, MOBILE_POINTER_QUERY } from "../utils/mobileDevice";

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(MOBILE_POINTER_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

export function useMobileDevice() {
  return useSyncExternalStore(subscribe, isMobileDevice, () => false);
}
