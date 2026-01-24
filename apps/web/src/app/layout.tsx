import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";
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
    <html lang="en">
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
        <DaemonProvider>
          <TabsProvider>{children}</TabsProvider>
        </DaemonProvider>
        <AgentationWrapper />
        <Toaster position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
