import { useEffect, useMemo, useState } from "react";

export interface SceneLifecycleState {
  visible: boolean;
  detailOpen: boolean;
  obscured: boolean;
  allowMotion: boolean;
}

function getDocumentVisible() {
  return (
    typeof document === "undefined" ||
    document.visibilityState === "visible"
  );
}

export function useSceneLifecycle({
  detailOpen,
}: {
  detailOpen: boolean;
}): SceneLifecycleState {
  const [visible, setVisible] = useState(getDocumentVisible);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateVisibility = () => {
      setVisible(document.visibilityState === "visible");
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  return useMemo(
    () => ({
      visible,
      detailOpen,
      obscured: !visible || detailOpen,
      allowMotion: visible && !detailOpen,
    }),
    [detailOpen, visible],
  );
}
