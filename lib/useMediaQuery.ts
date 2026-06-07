"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query and return whether it currently
 * matches. SSR-safe: returns `false` until mounted on the client so
 * the first paint matches the server markup, then updates.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * True when the viewport is portrait-ish — either a narrow screen or
 * taller-than-wide. Drives the poker table's vertical layout on
 * phones and portrait tablets.
 */
export function usePortrait(): boolean {
  return useMediaQuery("(max-width: 640px), (orientation: portrait)");
}
