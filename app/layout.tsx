import type { Metadata, Viewport } from "next";

import { DialogHost } from "@/components/DialogHost";
import "./globals.css";

export const metadata: Metadata = {
  title: "Texas Hold'em Online",
  description:
    "Real-time multiplayer Texas Hold'em. Create a table, share the link, play with automatic street timers.",
};

export const viewport: Viewport = {
  themeColor: "#0a3d2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `suppressHydrationWarning` is needed because browser extensions like
  // Dark Reader inject `data-darkreader-*` attributes and inline styles
  // into the DOM after SSR, which would otherwise trip the React
  // hydration mismatch check on Firefox/Chrome.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
        <DialogHost />
      </body>
    </html>
  );
}
