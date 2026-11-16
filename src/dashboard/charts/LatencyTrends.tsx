import Box from "@mui/material/Box";
import { useState } from "react";
import type { OutageView, Stats } from "../../../lib/apiTypes";
import { count, dateTime, time } from "../../format";
import { dataType, tokens } from "../../theme";
import { ChartFrame, ChartTooltip, Legend, LegendKey } from "./chartParts";
import { clampTipX, niceTicks, timeTicks, useWidth, type Tip } from "./chartUtils";

const PLOT = 64; // plot height per service
const TITLE = 24;
const ROW_GAP = 14;
const AXIS = 22;
const LINE = tokens.accent;

interface Props {
  trends: Stats["trends"];
  bucketMinutes: number;
  outages: OutageView[];
  start: number;
  end: number;
}

/**
 * p95 latency over time, one small chart per service on a shared time axis. Each service has its
 * own latency scale (svc-reports runs ~5× slower than svc-notify), labelled on its left edge.
 * Outage periods are shaded so slowdowns can be read against them.
 */
export function LatencyTrends({ trends, bucketMinutes, outages, start, end }: Props) {
  const [frame, width] = useWidth();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);

  const labelWidth = 52;
  const plotWidth = Math.max(width - labelWidth - 8, 120);
  const x = (ms: number) => labelWidth + ((ms - start) / (end - start)) * plotWidth;
  const msAt = (px: number) => start + ((px - labelWidth) / plotWidth) * (end - start);
  const bucketMs = bucketMinutes * 60_000;
  const rowHeight = TITLE + PLOT + ROW_GAP;
  const height = trends.length * rowHeight + AXIS - ROW_GAP;
  const ticks = timeTicks(start, end, plotWidth);
  const bucketLabel = bucketMinutes >= 60 ? `${bucketMinutes / 60}-hour` : `${bucketMinutes}-minute`;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (px < labelWidth || px > labelWidth + plotWidth) return setHoverAway();
    const row = Math.floor(py / rowHeight);
    const series = trends[row];
    if (!series || series.points.length === 0) return setHoverAway();
    const ms = msAt(px);
    const nearest = series.points.reduce((a, b) =>
      Math.abs(Date.parse(b.start) + bucketMs / 2 - ms) < Math.abs(Date.parse(a.start) + bucketMs / 2 - ms) ? b : a,
    );
    const pointMs = Date.parse(nearest.start);
    setHoverMs(pointMs + bucketMs / 2);
    setTip({
      x: clampTipX(x(pointMs + bucketMs / 2), width),
      y: row * rowHeight + TITLE,
      content: (
        <>
          <strong>
            {series.serviceId}, {dateTime(nearest.start)}–{time(new Date(pointMs + bucketMs).toISOString())} UTC
          </strong>
          <span>p95 latency {nearest.p95LatencyMs === null ? "–" : `${count(nearest.p95LatencyMs)} ms`}</span>
          <span>
            {count(nearest.failedChecks)} of {count(nearest.checks)} checks failed
          </span>
        </>
      ),
    });
  }

  function setHoverAway() {
    setTip(null);
    setHoverMs(null);
  }

  return (
    <Box>
      <Legend>
        <LegendKey swatch={<line x1="1" x2="15" y1="7" y2="7" stroke={LINE} strokeWidth="2" strokeLinecap="round" />}>
          p95 latency per {bucketLabel} window
        </LegendKey>
        <LegendKey swatch={<rect width="14" height="12" y="1" rx="2" fill={tokens.outageWash} stroke={tokens.outage} strokeOpacity={0.4} />}>
          Outage
        </LegendKey>
      </Legend>
      <ChartFrame frameRef={frame}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`p95 latency over time for ${trends.length} services. Exact values are in the Service health table.`}
            style={{ display: "block", overflow: "visible", ...dataType, touchAction: "pan-y" }}
            onPointerMove={onMove}
            onPointerLeave={setHoverAway}
          >
            {trends.map((series, row) => {
              const top = row * rowHeight + TITLE;
              const values = series.points.map((p) => p.p95LatencyMs).filter((v): v is number => v !== null);
              const yTicks = niceTicks(Math.max(...values, 1), 2);
              const yMax = yTicks.at(-1)!;
              const y = (v: number) => top + PLOT - (v / yMax) * PLOT;
              return (
                <g key={series.serviceId}>
                  <text x={labelWidth} y={top - 10} fontSize={13} fontWeight={600} fill={tokens.ink}>
                    {series.serviceId}
                  </text>
                  {outages
                    .filter((o) => o.serviceId === series.serviceId)
                    .map((o) => {
                      const x1 = Math.max(x(Date.parse(o.start)), labelWidth);
                      const x2 = Math.min(x(Date.parse(o.end)), labelWidth + plotWidth);
                      return x2 > x1 ? (
                        <rect key={o.start} x={x1} y={top} width={Math.max(x2 - x1, 3)} height={PLOT} fill={tokens.outageWash} />
                      ) : null;
                    })}
                  {yTicks.map((t) => (
                    <g key={t}>
                      <line x1={labelWidth} x2={labelWidth + plotWidth} y1={y(t)} y2={y(t)} stroke={t === 0 ? tokens.grid : tokens.hairline} />
                      {t > 0 && (
                        <text x={labelWidth - 6} y={y(t) + 4} fontSize={11} fill={tokens.muted} textAnchor="end">
                          {compactMs(t)}
                        </text>
                      )}
                    </g>
                  ))}
                  <path
                    d={linePath(series.points, (p) => x(Date.parse(p.start) + bucketMs / 2), y, bucketMs)}
                    fill="none"
                    stroke={LINE}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {hoverMs !== null && (
              <line x1={x(hoverMs)} x2={x(hoverMs)} y1={TITLE} y2={trends.length * rowHeight - ROW_GAP} stroke={tokens.muted} strokeWidth={1} />
            )}

            {ticks.map((t) => (
              <text key={t.ms} x={x(t.ms)} y={height - 6} fontSize={12} fill={tokens.muted} textAnchor="middle">
                {t.label}
              </text>
            ))}
          </svg>
        )}
        <ChartTooltip tip={tip} />
      </ChartFrame>
    </Box>
  );
}

/** A line that breaks where a bucket has no latency reading or is missing. */
function linePath(
  points: Stats["trends"][number]["points"],
  px: (p: Stats["trends"][number]["points"][number]) => number,
  py: (v: number) => number,
  bucketMs: number,
): string {
  let d = "";
  let previous: number | null = null;
  for (const p of points) {
    const t = Date.parse(p.start);
    if (p.p95LatencyMs === null) {
      previous = null;
      continue;
    }
    const joined = previous !== null && t - previous <= bucketMs;
    d += `${joined ? "L" : "M"}${px(p).toFixed(1)},${py(p.p95LatencyMs).toFixed(1)}`;
    previous = t;
  }
  return d;
}

const compactMs = (v: number) => (v >= 1000 ? `${v / 1000}s` : `${v}ms`);
