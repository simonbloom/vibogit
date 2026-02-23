"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const downloads = [
  {
    name: "Download for Apple Silicon",
    description: "macOS 12+ (M1/M2/M3/M4)",
    href: "https://github.com/simonbloom/vibogit/releases/latest/download/ViboGit_3.7.5_aarch64.dmg",
  },
  {
    name: "Download for Intel Mac",
    description: "macOS 12+ (x64)",
    href: "https://github.com/simonbloom/vibogit/releases/latest/download/ViboGit_3.7.5_x64.dmg",
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
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Hero Section */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-6 py-24 text-center sm:px-8 sm:py-32">
        <div className="mb-8 flex items-center justify-center gap-4">
          <Image src="/35-sparkline-cute-robot.png" alt="ViboGit Robot" width={80} height={80} className="rounded-full bg-accent p-2" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
          Stop getting lost in your projects.
        </h1>
        <p className="mt-6 max-w-2xl text-xl text-muted-foreground sm:text-2xl">
          ViboGit is your shortcut manager for repo work. It doesn&apos;t reinvent the wheel. It makes the wheel turn faster.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {downloads.map((download) => (
            <a
              key={download.name}
              href={download.href}
              target="_blank"
              rel="noreferrer"
              className="flex w-full flex-col items-center justify-center rounded-xl bg-primary px-8 py-4 text-primary-foreground transition hover:bg-primary/90 sm:w-auto"
            >
              <span className="font-semibold">{download.name}</span>
              <span className="text-xs opacity-80">{download.description}</span>
            </a>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
          <a href="https://github.com/simonbloom/vibogit/releases" target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">
            View all releases
          </a>
          <span className="hidden sm:inline">•</span>
          <Link href="/app" className="hover:text-foreground hover:underline">
            Open Web App
          </Link>
        </div>
      </section>

      {/* Why it exists */}
      <section className="bg-accent/50 px-6 py-20 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Why I built this</h2>
          <blockquote className="mt-8 border-l-4 border-primary pl-6 text-left text-xl italic text-muted-foreground sm:text-2xl">
            &quot;I had too many active vibe projects and needed one place for frequent actions. I didn&apos;t want to replace Git, I just wanted to stop context switching to find my terminal, editor, or browser preview.&quot;
          </blockquote>
        </div>
      </section>

      {/* Core Skills */}
      <section className="mx-auto max-w-5xl px-6 py-24 sm:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold sm:text-5xl">Core Skills</h2>
          <p className="mt-4 text-xl text-muted-foreground">Everything you use most, one click away.</p>
        </div>

        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col items-start text-left">
            <div className="mb-6 rounded-2xl bg-accent p-4">
              <Image src="/42-seo-optimized-robot.png" alt="Shortcut Manager" width={64} height={64} />
            </div>
            <h3 className="text-2xl font-semibold">Shortcut Manager</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              One-click launches to Finder, localhost preview, GitHub, preferred terminal, and preferred IDE directly from the top-right action strip.
            </p>
          </div>

          <div className="flex flex-col items-start text-left">
            <div className="mb-6 rounded-2xl bg-accent p-4">
              <Image src="/38-rocket-standing-robot.png" alt="Quick Commit" width={64} height={64} />
            </div>
            <h3 className="text-2xl font-semibold">Quick Commit</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Accelerate common flows. Stage changes, generate a commit message, and commit in one action for those &quot;do this 40x/day&quot; moments.
            </p>
          </div>

          <div className="flex flex-col items-start text-left">
            <div className="mb-6 rounded-2xl bg-accent p-4">
              <Image src="/23-warehouse-box-robot.png" alt="Multi-Project" width={64} height={64} />
            </div>
            <h3 className="text-2xl font-semibold">Multi-Project View</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              A command center sidebar with per-repo status signals (changes, ahead/behind, branch) to prevent getting lost across parallel projects.
            </p>
          </div>

          <div className="flex flex-col items-start text-left">
            <div className="mb-6 rounded-2xl bg-accent p-4">
              <Image src="/03-phone-reading-box-robot.png" alt="Tool Targeting" width={64} height={64} />
            </div>
            <h3 className="text-2xl font-semibold">Workflow Native</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Set your editor and terminal once. All quick actions open your right tool automatically (Cursor, VS Code, Ghostty, Warp, etc.).
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-accent/30 px-6 py-24 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold sm:text-5xl">How it works</h2>
          <div className="mt-16 grid gap-8 sm:grid-cols-3 relative">
            <div className="hidden sm:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-border -z-10"></div>
            
            <div className="flex flex-col items-center bg-background p-8 rounded-2xl shadow-sm border border-border">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground mb-6">1</div>
              <h3 className="text-xl font-semibold">Add Projects</h3>
              <p className="mt-2 text-center text-muted-foreground text-sm">Drop in your active repos to build your dashboard.</p>
            </div>
            
            <div className="flex flex-col items-center bg-background p-8 rounded-2xl shadow-sm border border-border">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground mb-6">2</div>
              <h3 className="text-xl font-semibold">Jump Tools</h3>
              <p className="mt-2 text-center text-muted-foreground text-sm">Use top-right quick links to instantly open your IDE or terminal.</p>
            </div>
            
            <div className="flex flex-col items-center bg-background p-8 rounded-2xl shadow-sm border border-border">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground mb-6">3</div>
              <h3 className="text-xl font-semibold">Ship Faster</h3>
              <p className="mt-2 text-center text-muted-foreground text-sm">Use Quick Commit for rapid iterations and push.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Not a replacement */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center sm:px-8">
        <h2 className="text-4xl font-bold sm:text-5xl">Not a Git Replacement</h2>
        <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-muted-foreground">
          Keep your normal Git flow for complex branching and rebasing. ViboGit simply sits on top to remove repetitive clicks for your day-to-day &quot;vibe coding&quot; momentum.
        </p>
        
        <div className="mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {downloads.map((download) => (
            <a
              key={download.name}
              href={download.href}
              target="_blank"
              rel="noreferrer"
              className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-primary/20 bg-background px-8 py-4 transition hover:border-primary hover:bg-accent sm:w-auto"
            >
              <span className="font-semibold text-foreground">{download.name}</span>
              <span className="text-xs text-muted-foreground">{download.description}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
