import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@vibogit/ui/providers/ThemeProvider";
import { MatrixRain, CRTOverlay } from "@vibogit/ui/components/effects";
import { MatrixVideoFilter, DarkModeVideoFilter, EmberVideoFilter } from "@vibogit/ui/components/ui/video-filters";
import { DaemonProvider } from "@vibogit/ui/lib/daemon-context";
import { ConfigProvider } from "@vibogit/ui/lib/config-context";
import { TabsProvider } from "@vibogit/ui/lib/tabs-context";
import { ProjectsProvider } from "@vibogit/ui/lib/projects-context";
import { ThemeSync } from "@vibogit/ui/components/theme-sync";
import { AgentationWrapper } from "@vibogit/ui/components/agentation-wrapper";

export const metadata: Metadata = {
  title: "ViboGit",
  description: "Desktop Git client powered by Tauri",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <MatrixRain />
          <DaemonProvider>
            <ProjectsProvider>
              <ConfigProvider>
                <ThemeSync />
                <TabsProvider>{children}</TabsProvider>
              </ConfigProvider>
            </ProjectsProvider>
          </DaemonProvider>
          <AgentationWrapper />
          <CRTOverlay />
          <MatrixVideoFilter />
          <DarkModeVideoFilter />
          <EmberVideoFilter />
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
