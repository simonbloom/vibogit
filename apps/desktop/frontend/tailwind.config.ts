import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Overpass", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Overpass Mono", "ui-monospace", "monospace"],
        heading: ["Overpass Mono", "ui-monospace", "monospace"],
      },
      colors: {
        "text-dark": "hsl(var(--text-dark))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        "nav-icon": {
          dashboard: "hsl(var(--nav-icon-dashboard))",
          knowledge: "hsl(var(--nav-icon-knowledge))",
          tasks: "hsl(var(--nav-icon-tasks))",
          calendar: "hsl(var(--nav-icon-calendar))",
          inputs: "hsl(var(--nav-icon-inputs))",
          subscriptions: "hsl(var(--nav-icon-subscriptions))",
          playlists: "hsl(var(--nav-icon-playlists))",
          coding: "hsl(var(--nav-icon-coding))",
          team: "hsl(var(--nav-icon-team))",
          spaces: "hsl(var(--nav-icon-spaces))",
          settings: "hsl(var(--nav-icon-settings))",
          analytics: "hsl(var(--nav-icon-analytics))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
