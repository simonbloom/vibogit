import type { Metadata } from "next";
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
      <body className="antialiased min-h-screen">
        <DaemonProvider>
          <TabsProvider>{children}</TabsProvider>
        </DaemonProvider>
        <AgentationWrapper />
      </body>
    </html>
  );
}
