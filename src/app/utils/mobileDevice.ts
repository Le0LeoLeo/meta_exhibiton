export const MOBILE_POINTER_QUERY = "(pointer: coarse)";

// Device capability, not viewport width: rotating a phone must not enable editing.
export function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return (window.matchMedia?.(MOBILE_POINTER_QUERY).matches ?? false)
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
