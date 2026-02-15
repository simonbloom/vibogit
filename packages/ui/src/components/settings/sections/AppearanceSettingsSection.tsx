"use client";

import { ThemeToggle } from "@/components/settings/ThemeToggle";

export function AppearanceSettingsSection() {
  return (
    <section className="space-y-5">
      <ThemeToggle />
    </section>
  );
}
