"use client";

import { cn } from "@/lib/cn";
import { formatCard } from "@/lib/poker";

type Props = {
  code: string | null;
  faceUp: boolean;
  highlight?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-7 w-5 text-[8px] sm:h-9 sm:w-6 sm:text-[10px]",
  sm: "h-10 w-7 text-[10px] sm:h-12 sm:w-9 sm:text-xs",
  md: "h-14 w-10 text-sm sm:h-16 sm:w-12 sm:text-base",
  lg: "h-16 w-12 text-base sm:h-20 sm:w-14 sm:text-lg",
};

const CENTER: Record<NonNullable<Props["size"]>, string> = {
  xs: "text-xs sm:text-sm",
  sm: "text-base sm:text-lg",
  md: "text-xl sm:text-2xl",
  lg: "text-2xl sm:text-3xl",
};

export function Card({
  code,
  faceUp,
  highlight = false,
  size = "md",
  className,
}: Props) {
  const hasCard = code !== null && code !== undefined && code !== "";

  if (!hasCard) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-dashed border-gold/40 bg-felt-dark/40 text-gold/40",
          SIZE[size],
          className,
        )}
      >
        <span className="text-base">·</span>
      </div>
    );
  }

  const { rank, glyph, red } = formatCard(code);
  const colorClass = red ? "text-cardRed" : "text-cardBlack";
  const showFront = faceUp;

  return (
    <div className={cn("perspective", className)}>
      <div
        className={cn(
          "preserve-3d relative transition-transform duration-500",
          SIZE[size],
          showFront ? "" : "rotate-y-180",
        )}
      >
        <div
          className={cn(
            "backface-hidden absolute inset-0 overflow-hidden rounded-lg border bg-ivory-soft font-bold",
            highlight
              ? "border-gold shadow-[0_0_0_3px_rgba(212,175,55,0.55),0_0_18px_rgba(212,175,55,0.45)]"
              : "border-gold/60 shadow-[0_2px_6px_rgba(0,0,0,0.35)]",
          )}
        >
          {showFront ? (
            <div className={cn("relative h-full w-full", colorClass)}>
              <div className="absolute left-0.5 top-0.5 flex flex-col items-center leading-none sm:left-1 sm:top-1">
                <span className="text-[8px] font-bold sm:text-[10px]">{rank}</span>
                <span className="text-[8px] sm:text-[10px]">{glyph}</span>
              </div>
              <div className="absolute bottom-0.5 right-0.5 flex rotate-180 flex-col items-center leading-none sm:bottom-1 sm:right-1">
                <span className="text-[8px] font-bold sm:text-[10px]">{rank}</span>
                <span className="text-[8px] sm:text-[10px]">{glyph}</span>
              </div>
              <div className="flex h-full w-full items-center justify-center">
                <span
                  className={cn(
                    "absolute select-none font-serif opacity-15",
                    CENTER[size],
                  )}
                  style={{ fontSize: "180%" }}
                  aria-hidden
                >
                  {glyph}
                </span>
                <span
                  className={cn(
                    "relative font-serif font-bold tracking-tight",
                    CENTER[size],
                  )}
                >
                  {rank}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "backface-hidden rotate-y-180 absolute inset-0 overflow-hidden rounded-lg border-2 border-gold bg-cardRed",
            "shadow-[inset_0_0_0_2px_rgba(245,233,201,0.85),inset_0_0_0_3px_#9a1623]",
          )}
        >
          <div
            className="absolute inset-1 rounded-sm"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(245,215,110,0.45) 0px, rgba(245,215,110,0.45) 2px, transparent 2px, transparent 6px), repeating-linear-gradient(-45deg, rgba(245,215,110,0.45) 0px, rgba(245,215,110,0.45) 2px, transparent 2px, transparent 6px)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-[10px] font-bold tracking-widest text-gold-soft drop-shadow-[0_1px_0_rgba(0,0,0,0.5)] sm:text-xs">
              ♣♥♠♦
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
