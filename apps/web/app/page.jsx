"use client";

import { useState } from "react";

export default function Home() {
  const [saving, setSaving] = useState(false);
  const [shipping, setShipping] = useState(false);

  const project = { name: "vibogit", path: "/Users/demo/vibogit" };
  const status = {
    branch: "main",
    changedFiles: [
      { path: "src/app/page.tsx", status: "modified" },
      { path: "src/lib/git.ts", status: "modified" },
    ],
    untrackedFiles: ["src/components/Button.tsx"],
    ahead: 2,
  };

  const totalChanges = status.changedFiles.length + status.untrackedFiles.length;

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  const handleShip = async () => {
    setShipping(true);
    setTimeout(() => setShipping(false), 1000);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.projectName}>{project.name}</h1>
        <span style={styles.branch}>{status.branch}</span>
      </header>

      <div style={styles.actions}>
        <button
          style={{
            ...styles.actionButton,
            ...styles.saveButton,
            opacity: saving || totalChanges === 0 ? 0.5 : 1,
          }}
          onClick={handleSave}
          disabled={saving || totalChanges === 0}
        >
          <span style={styles.actionIcon}>⚡</span>
          <span style={styles.actionLabel}>SAVE</span>
          <span style={styles.actionSubtext}>
            {totalChanges} change{totalChanges !== 1 ? "s" : ""} ready
          </span>
        </button>

        <button
          style={{
            ...styles.actionButton,
            ...styles.shipButton,
            opacity: shipping || status.ahead === 0 ? 0.5 : 1,
          }}
          onClick={handleShip}
          disabled={shipping || status.ahead === 0}
        >
          <span style={styles.actionIcon}>🚀</span>
          <span style={styles.actionLabel}>SHIP</span>
          <span style={styles.actionSubtext}>
            {status.ahead} save{status.ahead !== 1 ? "s" : ""} to ship
          </span>
        </button>
      </div>

      <div style={styles.changes}>
        <h2 style={styles.sectionTitle}>CHANGES ({totalChanges})</h2>
        {status.changedFiles.map((file) => (
          <div key={file.path} style={styles.fileItem}>
            <span style={styles.fileIcon}>📝</span>
            <span style={styles.fileName}>{file.path}</span>
            <span style={styles.fileStatus}>{file.status}</span>
          </div>
        ))}
        {status.untrackedFiles.map((path) => (
          <div key={path} style={styles.fileItem}>
            <span style={styles.fileIcon}>✨</span>
            <span style={styles.fileName}>{path}</span>
            <span style={styles.fileStatus}>new</span>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <p style={styles.hint}>
          Preview mode • Cmd+S to save • Cmd+Shift+S to ship
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    maxWidth: 800,
    margin: "0 auto",
    padding: 24,
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#fafafa",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 32,
    paddingBottom: 16,
    borderBottom: "1px solid #222",
  },
  projectName: {
    fontSize: 24,
    fontWeight: 600,
    margin: 0,
  },
  branch: {
    padding: "4px 12px",
    backgroundColor: "#222",
    borderRadius: 16,
    fontSize: 14,
    color: "#888",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    transition: "transform 0.1s, opacity 0.2s",
  },
  saveButton: {
    backgroundColor: "#1a2a1a",
    color: "#4ade80",
  },
  shipButton: {
    backgroundColor: "#2a1a1a",
    color: "#e69a4d",
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 2,
  },
  actionSubtext: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  changes: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 1,
    color: "#666",
    marginBottom: 16,
    marginTop: 0,
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid #222",
  },
  fileIcon: {
    fontSize: 16,
  },
  fileName: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 14,
  },
  fileStatus: {
    fontSize: 12,
    color: "#4ade80",
    textTransform: "uppercase",
  },
  footer: {
    marginTop: 32,
    textAlign: "center",
  },
  hint: {
    fontSize: 14,
    color: "#666",
  },
};
