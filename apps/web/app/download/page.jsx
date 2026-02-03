"use client";

import { useEffect, useState } from "react";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: ReleaseAsset[];
}

export default function DownloadPage() {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRelease() {
      try {
        // TODO: Replace with actual GitHub repo
        const res = await fetch(
          "https://api.github.com/repos/vibogit/vibogit/releases/latest"
        );
        if (res.ok) {
          const data = await res.json();
          setRelease(data);
        }
      } catch {
        // Ignore - will show fallback
      } finally {
        setLoading(false);
      }
    }
    fetchRelease();
  }, []);

  const dmgAsset = release?.assets.find((a) => a.name.endsWith(".dmg"));
  const version = release?.tag_name?.replace("v", "") || "0.1.0";

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <a href="/" style={styles.logo}>
          ViboGit
        </a>
        <nav style={styles.nav}>
          <a href="/docs" style={styles.navLink}>Docs</a>
          <a href="https://github.com/vibogit/vibogit" style={styles.navLink}>GitHub</a>
        </nav>
      </header>

      <main style={styles.main}>
        <h1 style={styles.title}>Download ViboGit</h1>
        <p style={styles.subtitle}>Git for the Vibe Coder</p>

        <div style={styles.downloadCard}>
          <div style={styles.platform}>
            <span style={styles.platformIcon}>🍎</span>
            <div>
              <h2 style={styles.platformName}>macOS</h2>
              <p style={styles.platformReq}>macOS 10.15 or later</p>
            </div>
          </div>

          {loading ? (
            <div style={styles.loading}>Checking for latest release...</div>
          ) : dmgAsset ? (
            <a
              href={dmgAsset.browser_download_url}
              style={styles.downloadButton}
            >
              Download for macOS
              <span style={styles.downloadMeta}>
                v{version} · {formatSize(dmgAsset.size)}
              </span>
            </a>
          ) : (
            <a
              href="https://github.com/vibogit/vibogit/releases/latest"
              style={styles.downloadButton}
            >
              Download from GitHub
              <span style={styles.downloadMeta}>v{version}</span>
            </a>
          )}
        </div>

        <div style={styles.altDownloads}>
          <h3 style={styles.altTitle}>Alternative Installation</h3>

          <div style={styles.altMethod}>
            <h4 style={styles.altMethodTitle}>Homebrew</h4>
            <code style={styles.code}>brew install --cask vibogit</code>
          </div>

          <div style={styles.altMethod}>
            <h4 style={styles.altMethodTitle}>Browser Mode (no install)</h4>
            <p style={styles.altMethodDesc}>
              Run the daemon locally and use ViboGit in your browser:
            </p>
            <code style={styles.code}>npx vibogit</code>
            <p style={styles.altMethodDesc}>
              Then open{" "}
              <a href="https://vibogit.app" style={styles.link}>
                vibogit.app
              </a>
            </p>
          </div>
        </div>

        <div style={styles.features}>
          <h3 style={styles.featuresTitle}>What you get</h3>
          <ul style={styles.featuresList}>
            <li>⚡ One-click save (stage + commit)</li>
            <li>🚀 One-click ship (push to remote)</li>
            <li>🔄 Auto-sync with visual diff</li>
            <li>📊 Beautiful timeline view</li>
            <li>🖥️ Native system tray with status</li>
            <li>⌨️ Keyboard shortcuts (Cmd+S, Cmd+Shift+S)</li>
            <li>🔔 Native macOS notifications</li>
            <li>🔄 Automatic updates</li>
          </ul>
        </div>

        {release && (
          <div style={styles.changelog}>
            <h3 style={styles.changelogTitle}>
              What&apos;s New in {release.tag_name}
            </h3>
            <div style={styles.changelogBody}>
              {release.body || "See GitHub for release notes."}
            </div>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <p>
          Made with ❤️ for Vibe Coders ·{" "}
          <a href="https://github.com/vibogit/vibogit" style={styles.footerLink}>
            Open Source
          </a>
        </p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#fafafa",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 40px",
    borderBottom: "1px solid #222",
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    color: "#e69a4d",
    textDecoration: "none",
  },
  nav: {
    display: "flex",
    gap: 24,
  },
  navLink: {
    color: "#888",
    textDecoration: "none",
  },
  main: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "60px 24px",
    textAlign: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: 700,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    color: "#888",
    marginBottom: 48,
  },
  downloadCard: {
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 32,
    marginBottom: 48,
  },
  platform: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 24,
  },
  platformIcon: {
    fontSize: 48,
  },
  platformName: {
    fontSize: 24,
    fontWeight: 600,
    margin: 0,
  },
  platformReq: {
    fontSize: 14,
    color: "#666",
    margin: 0,
  },
  loading: {
    color: "#666",
    padding: 16,
  },
  downloadButton: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 48px",
    backgroundColor: "#e69a4d",
    color: "#0a0a0a",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 18,
  },
  downloadMeta: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 4,
  },
  altDownloads: {
    textAlign: "left",
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 32,
    marginBottom: 48,
  },
  altTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 24,
  },
  altMethod: {
    marginBottom: 24,
  },
  altMethodTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#888",
    marginBottom: 8,
  },
  altMethodDesc: {
    fontSize: 14,
    color: "#888",
    margin: "8px 0",
  },
  code: {
    display: "block",
    backgroundColor: "#1a1a1a",
    padding: "12px 16px",
    borderRadius: 8,
    fontFamily: "monospace",
    fontSize: 14,
    color: "#4ade80",
  },
  link: {
    color: "#e69a4d",
  },
  features: {
    textAlign: "left",
    marginBottom: 48,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
  },
  featuresList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  changelog: {
    textAlign: "left",
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 32,
  },
  changelogTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
  },
  changelogBody: {
    fontSize: 14,
    color: "#888",
    whiteSpace: "pre-wrap",
  },
  footer: {
    textAlign: "center",
    padding: 40,
    borderTop: "1px solid #222",
    color: "#666",
  },
  footerLink: {
    color: "#888",
  },
};
