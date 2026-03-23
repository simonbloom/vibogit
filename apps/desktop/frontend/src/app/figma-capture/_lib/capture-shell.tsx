"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@vibogit/ui/lib/utils";
import { THEME_NAMES, TOKEN_GROUPS, type ThemeName } from "./mock-data";

export function FigmaCanvasLayout({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
    };

    html.style.overflow = "auto";
    html.style.height = "auto";
    body.style.overflow = "auto";
    body.style.height = "auto";
    setMounted(true);

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-200 px-10 py-8 text-foreground">
      <div className="mx-auto flex max-w-[1900px] flex-col gap-8">{children}</div>
    </div>
  );
}

export function FigmaPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="rounded-3xl border border-slate-300 bg-white/90 px-8 py-6 shadow-sm backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
    </header>
  );
}

export function FigmaSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-slate-300 bg-slate-100/90 p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-6">{children}</div>
    </section>
  );
}

export function CaptureCard({
  label,
  meta,
  className,
  children,
}: {
  label: string;
  meta?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">{label}</h3>
        {meta ? <span className="text-xs text-slate-500">{meta}</span> : null}
      </div>
      {children}
    </article>
  );
}

export function DesktopPreview({
  children,
  width = 1440,
  height = 900,
  className,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-[28px] border border-slate-400 bg-background shadow-[0_24px_60px_rgba(15,23,42,0.18)]", className)}
      style={{ width, height }}
    >
      <div className="h-full w-full bg-background">{children}</div>
    </div>
  );
}

export function MiniPreview({
  children,
  width = 680,
  height = 56,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-[20px] border border-slate-400 bg-background shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
      style={{ width, height }}
    >
      <div className="h-full w-full bg-background">{children}</div>
    </div>
  );
}

export function ThemeTokenTable() {
  const [values, setValues] = useState<Record<ThemeName, Record<string, string>>>({
    light: {},
    dark: {},
    ember: {},
    matrix: {},
  });

  useEffect(() => {
    const next = {} as Record<ThemeName, Record<string, string>>;

    for (const theme of THEME_NAMES) {
      const probe = document.createElement("div");
      probe.className = theme;
      probe.style.position = "absolute";
      probe.style.opacity = "0";
      probe.style.pointerEvents = "none";
      document.body.appendChild(probe);
      const styles = getComputedStyle(probe);
      next[theme] = {};
      for (const group of TOKEN_GROUPS) {
        for (const token of group.tokens) {
          next[theme][token] = styles.getPropertyValue(token).trim();
        }
      }
      document.body.removeChild(probe);
    }

    setValues(next);
  }, []);

  const rows = useMemo(
    () =>
      TOKEN_GROUPS.flatMap((group) =>
        group.tokens.map((token) => ({
          group: group.title,
          token,
          values: THEME_NAMES.map((theme) => ({ theme, value: values[theme][token] || "…" })),
        }))
      ),
    [values]
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-sm">
      <div className="grid grid-cols-[160px_220px_repeat(4,minmax(160px,1fr))] border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        <div className="px-4 py-3">Group</div>
        <div className="px-4 py-3">Token</div>
        {THEME_NAMES.map((theme) => (
          <div key={theme} className="px-4 py-3">
            {theme}
          </div>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={`${row.group}-${row.token}`}
          className="grid grid-cols-[160px_220px_repeat(4,minmax(160px,1fr))] border-t border-slate-100 text-sm"
        >
          <div className="px-4 py-3 text-slate-500">{row.group}</div>
          <div className="px-4 py-3 font-mono text-slate-700">{row.token}</div>
          {row.values.map(({ theme, value }) => (
            <div key={`${row.token}-${theme}`} className="px-4 py-3 font-mono text-xs text-slate-600">
              {value}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
