import type { Metadata } from "next";
import { ScreensCapturePage } from "../_lib/screens-page";

export const metadata: Metadata = {
  title: "Screens",
};

export default function Page() {
  return <ScreensCapturePage />;
}
