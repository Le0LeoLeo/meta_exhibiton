import { useEffect } from "react";

import type { AppMode } from "../types";

export function usePointerLockExitOnEdit(mode: AppMode) {
  useEffect(() => {
    if (mode === "edit" && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [mode]);
}
