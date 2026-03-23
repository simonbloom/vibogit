"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vibogit/ui/components/ui/card";
import { CaptureCard, FigmaPageHeader, FigmaSection, ThemeTokenTable } from "./capture-shell";
import { THEME_NAMES, TOKEN_GROUPS, type ThemeName } from "./mock-data";

const COLOR_TOKENS = TOKEN_GROUPS.flatMap((group) => group.tokens).filter((token) => token !== "--radius");

function ThemePreview({ theme }: { theme: ThemeName }) {
  return (
    <div className={`${theme} overflow-hidden rounded-[28px] border border-slate-300 bg-background text-foreground shadow-sm`}>
      <div className="grid grid-cols-[1.2fr_0.8fr] gap-0">
        <div className="space-y-5 border-r border-border p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{theme}</p>
            <h3 className="mt-2 text-3xl font-semibold">ViboGit {theme} theme</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Canonical token preview using the same CSS variables that power the desktop app.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {COLOR_TOKENS.slice(0, 8).map((token) => (
              <div key={`${theme}-${token}`} className="rounded-2xl border border-border bg-card p-3">
                <div
                  className="h-16 rounded-xl border border-border"
                  style={{ backgroundColor: `hsl(var(${token}))` }}
                />
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">{token}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5 p-6">
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>Live font preview from the shared UI styles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Overpass</p>
                <p className="text-2xl font-semibold">Git for the Vibe Coder</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Overpass Mono</p>
                <p className="font-mono text-sm">bun run dev --port 4158</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">VT323</p>
                <p className="font-['VT323'] text-3xl">Matrix heading sample</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shape + Borders</CardTitle>
              <CardDescription>Shared radius scale and heavy outline usage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <div className="h-16 w-20 rounded-sm border-2 border-black bg-card" />
                <div className="h-16 w-20 rounded-md border-2 border-black bg-card" />
                <div className="h-16 w-20 rounded-lg border-2 border-black bg-card" />
              </div>
              <p className="font-mono text-xs text-muted-foreground">sm, md, lg radii map to the shared --radius token.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spacing Rules</CardTitle>
              <CardDescription>Representative horizontal rhythm from the app shell.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/20" />
                <div className="h-8 w-12 rounded-lg bg-primary/30" />
                <div className="h-8 w-16 rounded-lg bg-primary/40" />
                <div className="h-8 w-24 rounded-lg bg-primary/50" />
              </div>
              <p className="font-mono text-xs text-muted-foreground">Common shell gaps: 4, 8, 12, 16, 24, 32 px.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function StylesCapturePage() {
  return (
    <>
      <FigmaPageHeader
        eyebrow="Page 3"
        title="Style Guide"
        description="Typography, token mappings, and theme-system references derived from the shared CSS variable contract in the UI package."
      />

      <FigmaSection title="Typography + Theme Previews" description="One preview card per supported theme, all using the real token definitions.">
        {THEME_NAMES.map((theme) => (
          <CaptureCard key={theme} label={`Theme / ${theme}`} meta="1280 px">
            <ThemePreview theme={theme} />
          </CaptureCard>
        ))}
      </FigmaSection>

      <FigmaSection title="Theme Token Matrix" description="Computed CSS variable values for light, dark, ember, and matrix.">
        <CaptureCard label="Token Values" meta="Computed from live CSS variables">
          <ThemeTokenTable />
        </CaptureCard>
      </FigmaSection>
    </>
  );
}
