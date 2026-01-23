import type { Metadata } from "next";
import "./globals.css";
import { DaemonProvider } from "@/lib/daemon-context";

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
      <body className="antialiased">
        <DaemonProvider>{children}</DaemonProvider>
      </body>
    </html>
  );
}
