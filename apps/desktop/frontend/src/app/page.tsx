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

const vol11 = {
  dark: "#191919",
  pink: "#FC467D",
  pinkBorder: "#C93864",
  yellow: "#F2C740",
  orange: "#FA7E45",
};

function PinkButton({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      style={{
        backgroundColor: vol11.pink,
        color: "#fff",
        border: `2px solid ${vol11.pinkBorder}`,
        boxShadow: `0 3px 0 0 ${vol11.pinkBorder}`,
        borderRadius: 6,
        padding: "10px 24px",
        fontWeight: 500,
        fontSize: 16,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        textDecoration: "none",
        transition: "transform 0.1s, box-shadow 0.1s",
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 0 0 ${vol11.pinkBorder}`;
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 3px 0 0 ${vol11.pinkBorder}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 3px 0 0 ${vol11.pinkBorder}`;
      }}
    >
      {children}
    </a>
  );
}

function OutlineButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        backgroundColor: "transparent",
        color: "#fff",
        border: "2px solid rgba(255,255,255,0.2)",
        boxShadow: "0 3px 0 0 rgba(255,255,255,0.1)",
        borderRadius: 6,
        padding: "10px 24px",
        fontWeight: 500,
        fontSize: 16,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
        transition: "border-color 0.2s",
      }}
    >
      {children}
    </a>
  );
}

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isTauriRuntime()) {
      router.replace("/app");
      return;
    }
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, [router]);

  return (
    <main style={{ fontFamily: "'Overpass', sans-serif" }}>
      {/* Hero - Dark section */}
      <section
        style={{ backgroundColor: vol11.dark }}
        className="px-6 py-24 sm:px-8 sm:py-32"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center gap-4">
            <Image
              src="/35-sparkline-cute-robot.png"
              alt="ViboGit Robot"
              width={64}
              height={64}
              className="rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: 8 }}
            />
          </div>

          <p
            style={{
              color: vol11.orange,
              fontFamily: "'Overpass Mono', monospace",
              fontSize: 14,
              letterSpacing: 1,
              marginBottom: 16,
            }}
          >
            ViboGit
          </p>

          <h1
            style={{
              fontFamily: "'Overpass Mono', monospace",
              fontWeight: 400,
              letterSpacing: "-0.56px",
              lineHeight: 1,
              color: "#fff",
            }}
            className="text-5xl sm:text-6xl md:text-7xl"
          >
            stop getting lost in your projects
          </h1>

          <p
            className="mt-8 max-w-2xl text-lg sm:text-xl"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            ViboGit is your shortcut manager for repo work. It doesn&apos;t
            reinvent the wheel. It makes the wheel turn faster.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            {downloads.map((d) => (
              <PinkButton key={d.name} href={d.href}>
                <span>{d.name}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{d.description}</span>
              </PinkButton>
            ))}
            <OutlineButton href="https://github.com/simonbloom/vibogit/releases">
              View Releases
            </OutlineButton>
          </div>
        </div>
      </section>

      {/* Streamlined - White section with label */}
      <section className="px-6 py-20 sm:px-8" style={{ backgroundColor: "#fff" }}>
        <div className="mx-auto max-w-4xl text-center">
          <p
            style={{
              color: vol11.orange,
              fontFamily: "'Overpass Mono', monospace",
              fontSize: 14,
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Why it exists
          </p>
          <h2
            style={{
              fontFamily: "'Overpass Mono', monospace",
              fontWeight: 400,
              letterSpacing: "-0.48px",
              color: "#000",
            }}
            className="text-3xl sm:text-4xl"
          >
            Too many projects, too much friction
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#000" }}>
            I had too many active vibe projects and needed one place for
            frequent actions. I didn&apos;t want to replace Git, I just wanted
            to stop context switching to find my terminal, editor, or browser
            preview.
          </p>
        </div>
      </section>

      {/* Core Skills - 3 cards on white */}
      <section className="px-6 py-20 sm:px-8" style={{ backgroundColor: "#fff" }}>
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                img: "/42-seo-optimized-robot.png",
                title: "Shortcut Manager",
                desc: "One-click launches to Finder, localhost preview, GitHub, preferred terminal, and preferred IDE from the top-right action strip.",
              },
              {
                img: "/38-rocket-standing-robot.png",
                title: "Quick Commit",
                desc: "Stage changes, generate a commit message, and commit in one action for those frequent moments.",
              },
              {
                img: "/23-warehouse-box-robot.png",
                title: "Multi-Project View",
                desc: "A command center sidebar with per-repo status signals to prevent getting lost across parallel projects.",
              },
            ].map((skill) => (
              <div
                key={skill.title}
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #000",
                  borderRadius: 8,
                  padding: 32,
                  boxShadow: "0 3px 0 0 #000",
                }}
              >
                <Image
                  src={skill.img}
                  alt={skill.title}
                  width={80}
                  height={80}
                  className="mb-4"
                />
                <h3
                  style={{
                    fontFamily: "'Overpass Mono', monospace",
                    fontWeight: 400,
                    color: "#000",
                    fontSize: 20,
                    marginBottom: 8,
                  }}
                >
                  {skill.title}
                </h3>
                <p style={{ color: "#000", fontSize: 15, lineHeight: 1.6 }}>
                  {skill.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Native - Side-by-side on orange */}
      <section
        className="px-6 py-20 sm:px-8"
        style={{ backgroundColor: vol11.orange }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 sm:flex-row">
          <div className="flex-shrink-0">
            <Image
              src="/03-phone-reading-box-robot.png"
              alt="Workflow Native"
              width={200}
              height={200}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div>
            <p
              style={{
                fontFamily: "'Overpass Mono', monospace",
                fontSize: 14,
                letterSpacing: 1,
                marginBottom: 12,
                color: "#fff",
              }}
            >
              Your tools, your way
            </p>
            <h2
              style={{
                fontFamily: "'Overpass Mono', monospace",
                fontWeight: 400,
                letterSpacing: "-0.48px",
                color: "#fff",
              }}
              className="text-3xl sm:text-4xl"
            >
              Workflow Native
            </h2>
            <p className="mt-4 text-lg" style={{ color: "#fff" }}>
              Set your editor and terminal once. All quick actions open your
              right tool automatically. Cursor, VS Code, Zed, Ghostty, Warp,
              iTerm, Kitty &mdash; whatever you prefer.
            </p>
          </div>
        </div>
      </section>

      {/* How it works - Yellow CTA section */}
      <section
        className="px-6 py-20 sm:px-8"
        style={{ backgroundColor: vol11.yellow }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <h2
            style={{
              fontFamily: "'Overpass Mono', monospace",
              fontWeight: 400,
              letterSpacing: "-0.48px",
              color: "#000",
            }}
            className="text-3xl sm:text-4xl"
          >
            How it works
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Add Projects",
                desc: "Drop in your active repos to build your dashboard.",
              },
              {
                step: "2",
                title: "Jump Tools",
                desc: "Use top-right quick links to open your IDE, terminal, or browser.",
              },
              {
                step: "3",
                title: "Ship Faster",
                desc: "Quick Commit for rapid iterations, then push or open a PR.",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    backgroundColor: "#000",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Overpass Mono', monospace",
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 16,
                  }}
                >
                  {s.step}
                </div>
                <h3
                  style={{
                    fontFamily: "'Overpass Mono', monospace",
                    fontWeight: 400,
                    color: "#000",
                    fontSize: 20,
                    marginBottom: 8,
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ color: "#000", fontSize: 15 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Not a replacement - Dark section */}
      <section
        className="px-6 py-20 sm:px-8"
        style={{ backgroundColor: vol11.dark }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <h2
            style={{
              fontFamily: "'Overpass Mono', monospace",
              fontWeight: 400,
              letterSpacing: "-0.48px",
              color: "#fff",
            }}
            className="text-3xl sm:text-4xl"
          >
            Not a Git Replacement
          </h2>
          <p
            className="mx-auto mt-6 max-w-2xl text-lg"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            Keep your normal Git flow for complex branching and rebasing.
            ViboGit simply sits on top to remove repetitive clicks for your
            day-to-day momentum.
          </p>
        </div>
      </section>

      {/* FAQ - White section */}
      <section className="px-6 py-20 sm:px-8" style={{ backgroundColor: "#fff" }}>
        <div className="mx-auto max-w-3xl">
          <h2
            style={{
              fontFamily: "'Overpass Mono', monospace",
              fontWeight: 400,
              letterSpacing: "-0.48px",
              color: "#000",
              textAlign: "center",
            }}
            className="mb-4 text-3xl sm:text-4xl"
          >
            FAQs
          </h2>
          <p className="mb-10 text-center" style={{ color: "#000" }}>
            Common questions about ViboGit.
          </p>

          {[
            {
              q: "Is this a Git replacement?",
              a: "No. ViboGit is a speed layer on top of your existing Git workflow. It accelerates repetitive actions but never hides or replaces real Git commands.",
            },
            {
              q: "What editors and terminals does it support?",
              a: "Cursor, VS Code, Zed, Xcode, plus iTerm, Ghostty, Warp, Kitty, Terminal, and custom commands. Set once, used everywhere.",
            },
            {
              q: "Is it free?",
              a: "ViboGit is open source and free to download from GitHub Releases.",
            },
            {
              q: "Does it work on Intel Macs?",
              a: "Yes. Separate DMG builds are available for both Apple Silicon and Intel architectures.",
            },
          ].map((faq) => (
            <details
              key={faq.q}
              style={{
                borderBottom: "1px solid #e5e5e5",
                padding: "16px 0",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontFamily: "'Overpass Mono', monospace",
                  fontWeight: 400,
                  fontSize: 16,
                  color: "#000",
                  listStyle: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {faq.q}
                <span style={{ fontSize: 20, color: "#666" }}>+</span>
              </summary>
              <p className="mt-3" style={{ color: "#666", fontSize: 15, lineHeight: 1.6 }}>
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA - Dark section */}
      <section
        className="px-6 py-20 sm:px-8"
        style={{ backgroundColor: vol11.dark }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <h2
            style={{
              fontFamily: "'Overpass Mono', monospace",
              fontWeight: 400,
              letterSpacing: "-0.48px",
              color: "#fff",
            }}
            className="text-3xl sm:text-4xl"
          >
            Ready to stop context switching?
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-lg"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            Download ViboGit and take control of your multi-project workflow.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {downloads.map((d) => (
              <PinkButton key={d.name} href={d.href}>
                <span>{d.name}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{d.description}</span>
              </PinkButton>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            <a
              href="https://github.com/simonbloom/vibogit/releases"
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "underline", color: "rgba(255,255,255,0.6)" }}
            >
              View all releases
            </a>
            <Link
              href="/app"
              style={{ textDecoration: "underline", color: "rgba(255,255,255,0.6)" }}
            >
              Open Web App
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
