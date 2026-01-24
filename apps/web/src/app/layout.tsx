import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { MatrixRain, CRTOverlay } from "@/components/effects";
import { MatrixVideoFilter, DarkModeVideoFilter, EmberVideoFilter } from "@/components/ui/video-filters";
import { DaemonProvider } from "@/lib/daemon-context";
import { TabsProvider } from "@/lib/tabs-context";
import { AgentationWrapper } from "@/components/agentation-wrapper";

export const metadata: Metadata = {
  title: "ViboGit",
  description: "Web-based Git client with local daemon",
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
            <TabsProvider>{children}</TabsProvider>
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
