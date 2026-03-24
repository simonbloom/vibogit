import type { Metadata } from "next";
import Script from "next/script";
import { FigmaCanvasLayout } from "./_lib/capture-shell";

export const metadata: Metadata = {
  title: "ViboGit Figma Capture",
};

export default function FigmaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" />
      <FigmaCanvasLayout>{children}</FigmaCanvasLayout>
    </>
  );
}
