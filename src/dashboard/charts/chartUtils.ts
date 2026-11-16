import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { count, shortDate, time } from "../../format";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
/** Minimum hover/focus target, in px. */
export const HIT = 24;

/** Validated with the dataviz palette script against the white chart surface (ordinal ramp, one hue). */
export const DOWNTIME_RAMP = ["#FB7185", "#E11D48", "#BE123C", "#881337"] as const;

/**
 * Error codes are identities, not magnitudes, so they take categorical slots in a fixed order:
 * a code keeps its color whatever the filter. Validated (adjacent CVD and normal-vision pass);
 * aqua is under 3:1 on white, so every bar also carries its count and the legend names each code.
 */
export const CODE_COLORS: Record<string, string> = {
  "500": "#2a78d6",
  "502": "#eb6834",
  "503": "#1baf7a",
  "504": "#6250d6",
};
export const OTHER_CODE_COLOR = "#8A969F";

export const CODE_MEANINGS: Record<string, string> = {
  "500": "Internal server error",
  "501": "Not implemented",
  "502": "Bad gateway",
  "503": "Service unavailable",
  "504": "Gateway timeout",
};

export const codeColor = (code: string) => CODE_COLORS[code] ?? OTHER_CODE_COLOR;
export const codeMeaning = (code: string) => CODE_MEANINGS[code] ?? "Server error";

export interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

/** ChartFrame's padding: chart coordinates start this far inside the frame. */
export const FRAME_PAD = 12;

/** Keeps a tooltip anchored inside the chart so it doesn't spill off the side. */
export const clampTipX = (x: number, width: number) => Math.min(Math.max(x, 110), Math.max(width - 110, 110));

/** Day ticks for multi-day ranges (thinned to fit), 3-hour ticks for a single day. All UTC. */
export function timeTicks(start: number, end: number, plotWidth = 800): { ms: number; label: string }[] {
  const days = (end - start) / DAY;
  if (days <= 1.5) {
    const step = plotWidth < 400 ? 6 : 3;
    const ticks = [];
    for (let ms = Math.ceil(start / (step * HOUR)) * step * HOUR; ms <= end; ms += step * HOUR) {
      ticks.push({ ms, label: time(new Date(ms).toISOString()) });
    }
    return ticks;
  }
  // About one label per 70px.
  const fit = Math.max(1, Math.floor(plotWidth / 70));
  const step = [1, 2, 5, 7, 10, 14].find((s) => days / s <= fit) ?? 14;
  const ticks = [];
  for (let ms = Math.ceil(start / DAY) * DAY, i = 0; ms <= end; ms += DAY, i++) {
    if (i % step === 0) ticks.push({ ms, label: shortDate(new Date(ms).toISOString()) });
  }
  return ticks;
}

/** Width of an element, kept up to date as it resizes. */
export function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Nice round axis ticks from 0 to at least `max`. */
export function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
  return ticks;
}

/** Downtime bins shared by the cards and the heatmap. */
export const DOWNTIME_BINS = [
  { min: 0, label: "None", color: "#EEF0F3" },
  { min: 0.001, label: "Under 1 h", color: DOWNTIME_RAMP[0] },
  { min: 60, label: "1–3 h", color: DOWNTIME_RAMP[1] },
  { min: 180, label: "3–6 h", color: DOWNTIME_RAMP[2] },
  { min: 360, label: "6 h or more", color: DOWNTIME_RAMP[3] },
] as const;

export function downtimeColor(minutes: number): string {
  return [...DOWNTIME_BINS].reverse().find((bin) => minutes >= bin.min)!.color;
}

/** "503 Service unavailable × 12, 502 Bad gateway × 3", most frequent first. */
export function errorSummary(codes: Record<string, number>): string {
  const entries = Object.entries(codes).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "none recorded";
  return entries.map(([code, n]) => `${code} ${codeMeaning(code)} × ${count(n)}`).join(", ");
}
