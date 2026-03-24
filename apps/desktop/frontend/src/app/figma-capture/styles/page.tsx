import type { Metadata } from "next";
import { StylesCapturePage } from "../_lib/styles-page";

export const metadata: Metadata = {
  title: "Style Guide",
};

export default function Page() {
  return <StylesCapturePage />;
}
