"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function CRTOverlay() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (!mounted || theme !== "matrix") return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes crt-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.98; }
        }
      `}} />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 9998 }}
        aria-hidden="true"
      >
        {/* Scanlines */}
        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.15),
              rgba(0, 0, 0, 0.15) 1px,
              transparent 1px,
              transparent 2px
            )`,
          }}
        />
        
        {/* Screen flicker */}
        {!reducedMotion && (
          <div
            className="absolute inset-0"
            style={{
              background: "transparent",
              animation: "crt-flicker 0.15s infinite",
            }}
          />
        )}

        {/* Vignette effect */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(
              ellipse at center,
              transparent 0%,
              transparent 60%,
              rgba(0, 0, 0, 0.4) 100%
            )`,
          }}
        />
      </div>
    </>
  );
}
