"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const downloads = [
  {
    name: "Download for Apple Silicon",
    description: "macOS 12+ (M1/M2/M3/M4)",
    href: "https://github.com/simonbloom/vibogit/releases/latest/download/ViboGit_3.7.3_aarch64.dmg",
  },
  {
    name: "Download for Intel Mac",
    description: "macOS 12+ (x64)",
    href: "https://github.com/simonbloom/vibogit/releases/latest/download/ViboGit_3.7.3_x64.dmg",
  },
];

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isTauriRuntime()) {
      router.replace("/app");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 py-16 sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">ViboGit</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Git for the Vibe Coder</h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          ViboGit is a native desktop Git client built with Tauri. Stage files, review changes, commit, sync, and manage branches with a fast interface designed for flow.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {downloads.map((download) => (
            <a
              key={download.name}
              href={download.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-accent"
            >
              <p className="font-medium">{download.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{download.description}</p>
            </a>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <a
            href="https://github.com/simonbloom/vibogit/releases"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            View all releases
          </a>
          <Link href="/app" className="underline underline-offset-4 hover:text-foreground">
            Open app route
          </Link>
        </div>
      </div>
    </main>
  );
}
