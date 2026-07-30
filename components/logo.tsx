import { cn } from "@/lib/utils";

/**
 * Reproduces the hoscoo.com brand mark exactly (a hub-and-spoke network icon
 * — the orchestration-layer metaphor) using currentColor/background so it
 * follows this app's own color tokens in both light and dark mode, rather
 * than shipping a static raster/SVG asset that would drift from the token
 * system. Source: the inline <svg> in hoscoo.com's header.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={cn("h-7 w-7 text-primary", className)} aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="currentColor" />
      <circle cx="14" cy="14" r="3" className="fill-background" />
      <circle cx="14" cy="5.5" r="1.9" className="fill-background/70" />
      <circle cx="14" cy="22.5" r="1.9" className="fill-background/70" />
      <circle cx="5.5" cy="14" r="1.9" className="fill-background/70" />
      <circle cx="22.5" cy="14" r="1.9" className="fill-background/70" />
      <path d="M14 11V7M14 17v4M11 14H7M17 14h4" className="stroke-background/70" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <LogoMark />
      Hoscoo
    </span>
  );
}
