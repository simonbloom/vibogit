"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useTheme } from "next-themes";

const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
const FONT_SIZE = 16;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const dropsRef = useRef<number[]>([]);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = "rgba(13, 13, 13, 0.05)";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#00FF41";
    ctx.font = `${FONT_SIZE}px 'VT323', monospace`;

    const columns = Math.floor(width / FONT_SIZE);
    const drops = dropsRef.current;

    if (drops.length !== columns) {
      dropsRef.current = Array(columns).fill(0).map(() => Math.random() * -100);
    }

    for (let i = 0; i < dropsRef.current.length; i++) {
      const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      const x = i * FONT_SIZE;
      const y = dropsRef.current[i] * FONT_SIZE;

      const brightness = Math.random() > 0.5 ? 1 : 0.5;
      ctx.fillStyle = brightness === 1 ? "#00FF41" : "#00CC33";
      
      ctx.fillText(char, x, y);

      if (y > height && Math.random() > 0.975) {
        dropsRef.current[i] = 0;
      }

      dropsRef.current[i] += 0.5 + Math.random() * 0.5;
    }
  }, []);

  useEffect(() => {
    if (theme !== "matrix") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = (currentTime: number) => {
      if (document.hidden) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = currentTime - lastFrameTimeRef.current;
      if (elapsed < FRAME_INTERVAL) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      lastFrameTimeRef.current = currentTime - (elapsed % FRAME_INTERVAL);
      draw(ctx, canvas.width, canvas.height);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [theme, draw]);

  if (!mounted || theme !== "matrix") return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    />
  );
}
