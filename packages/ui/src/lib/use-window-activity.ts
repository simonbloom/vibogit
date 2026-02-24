"use client";

import { useEffect, useState } from "react";

function getIsForeground(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible" && !document.hidden && window.document.hasFocus();
}

export function useWindowActivity() {
  const [isForeground, setIsForeground] = useState<boolean>(getIsForeground);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const sync = () => {
      setIsForeground(getIsForeground());
    };

    sync();

    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return { isForeground };
}
