import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#1a1a1a",
        surface: "#212121",
        "surface-light": "#2d2d2d",
        border: "#404040",
        "text-primary": "#e6e6e6",
        "text-secondary": "#808080",
        "text-muted": "#666666",
        accent: "#e69a4d",
        "status-modified": "#e69a4d",
        "status-added": "#66cc66",
        "status-deleted": "#e66666",
        "status-untracked": "#808080",
      },
      fontFamily: {
        mono: ["ui-monospace", "monospace"],
      },
    },
  },
} satisfies Config;
