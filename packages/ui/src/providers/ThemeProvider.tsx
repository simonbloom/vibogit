"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";
import { usePathname, useSearchParams } from "next/navigation";

export function ThemeProvider({
  children,
  forcedTheme: forcedThemeProp,
  enableSystem: enableSystemProp,
  ...props
}: ThemeProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFigmaExport = pathname.startsWith("/figma-export");
  const requestedTheme = searchParams.get("theme");
  const forcedTheme = isFigmaExport
    ? requestedTheme === "dark"
      ? "dark"
      : "light"
    : forcedThemeProp;

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={forcedTheme ? false : (enableSystemProp ?? true)}
      disableTransitionOnChange
      themes={["light", "dark", "ember", "matrix", "system"]}
      forcedTheme={forcedTheme}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
