import type { Metadata } from "next";
import { ComponentsCapturePage } from "../_lib/components-page";

export const metadata: Metadata = {
  title: "Components",
};

export default function Page() {
  return <ComponentsCapturePage />;
}
