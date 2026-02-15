"use client";

import { ThemeToggle } from "@/components/settings/ThemeToggle";

export function AppearanceSettingsSection() {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Appearance</h3>
          <p className="mt-1 text-sm text-muted-foreground">Pick the theme used across the entire app interface.</p>
        </div>

        <ThemeToggle />
      </div>
    </section>
  );
}
