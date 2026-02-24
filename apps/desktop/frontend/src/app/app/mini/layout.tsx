"use client";

import { useEffect } from "react";

export default function MiniLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Force html/body transparent for rounded corners to show through
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  return (
    <main
      className="h-screen w-screen overflow-hidden flex items-center justify-center p-1"
      style={{ background: "transparent" }}
    >
      {children}
    </main>
  );
}
