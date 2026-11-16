import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import type { ServiceStats } from "../../../lib/apiTypes";
import { count } from "../../format";
import { dataType, tokens } from "../../theme";
import { ChartFrame, ChartTooltip, Legend, LegendKey } from "./chartParts";
import { clampTipX, codeColor, codeMeaning, niceTicks, useWidth, type Tip } from "./chartUtils";

const ROW = 32;
const BAR = 18; // under the 24px bar cap
const GAP = 2;
const AXIS = 22;
const VALUE_ROOM = 44; // space at the bar tip for its total

/**
 * Why a service failed: its server errors split by status code, on one shared scale so the
 * services compare. Counts are agent reports, so a check seen failing by two agents counts twice.
 */
export function ErrorBreakdown({ services }: { services: ServiceStats[] }) {
  const [frame, width] = useWidth();
  const [tip, setTip] = useState<Tip | null>(null);

  const rows = services.map((s) => {
    const codes = Object.entries(s.statusCodes)
      .filter(([code]) => Number(code) >= 500)
      .sort(([a], [b]) => a.localeCompare(b));
    return { serviceId: s.serviceId, codes, total: codes.reduce((sum, [, n]) => sum + n, 0) };
  });
  const allCodes = [...new Set(rows.flatMap((r) => r.codes.map(([code]) => code)))].sort();
  const max = Math.max(...rows.map((r) => r.total), 0);

  if (max === 0) {
    return <Typography color="text.secondary">No server errors in these dates.</Typography>;
  }

  const labelWidth = width < 600 ? 84 : 108;
  const plotWidth = Math.max(width - labelWidth - VALUE_ROOM, 60);
  const ticks = niceTicks(max, width < 600 ? 2 : 4);
  const scaleMax = ticks.at(-1)!;
  const x = (value: number) => labelWidth + (value / scaleMax) * plotWidth;
  const height = rows.length * ROW + AXIS;

  return (
    <Box>
      <Legend>
        {allCodes.map((code) => (
          <LegendKey key={code} swatch={<rect width="14" height="12" y="1" rx="2" fill={codeColor(code)} />}>
            <strong>{code}</strong> {codeMeaning(code)}
          </LegendKey>
        ))}
      </Legend>
      <ChartFrame frameRef={frame}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Server errors by status code: ${rows.map((r) => `${r.serviceId} ${r.codes.map(([c, n]) => `${n} × ${c}`).join(", ") || "none"}`).join("; ")}`}
            style={{ display: "block", overflow: "visible", ...dataType }}
            onPointerLeave={() => setTip(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={0} y2={rows.length * ROW} stroke={tokens.hairline} />
                <text x={x(t)} y={rows.length * ROW + 16} fontSize={12} fill={tokens.muted} textAnchor="middle">
                  {count(t)}
                </text>
              </g>
            ))}
            {rows.map((row, i) => {
              const y = i * ROW + (ROW - BAR) / 2;
              let offset = 0;
              return (
                <g key={row.serviceId}>
                  <text x={0} y={i * ROW + ROW / 2 + 4} fontSize={13} fill={tokens.ink}>
                    {row.serviceId}
                  </text>
                  {row.codes.map(([code, n], j) => {
                    const x1 = x(offset);
                    offset += n;
                    const last = j === row.codes.length - 1;
                    const w = Math.max(x(offset) - x1 - (last ? 0 : GAP), 1);
                    const share = Math.round((100 * n) / row.total);
                    return (
                      <g
                        key={code}
                        onPointerEnter={() =>
                          setTip({
                            x: clampTipX(x1 + w / 2, width),
                            y,
                            content: (
                              <>
                                <strong>
                                  {row.serviceId}: {code} {codeMeaning(code)}
                                </strong>
                                <span>
                                  {count(n)} reports, {share}% of its server errors
                                </span>
                              </>
                            ),
                          })
                        }
                      >
                        <rect x={x1} y={i * ROW} width={w + (last ? 0 : GAP)} height={ROW} fill="transparent" />
                        <path d={barPath(x1, y, w, BAR, last ? 4 : 0)} fill={codeColor(code)} />
                      </g>
                    );
                  })}
                  <text x={x(row.total) + 6} y={i * ROW + ROW / 2 + 4} fontSize={13} fill={tokens.inkSecondary}>
                    {count(row.total)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        <ChartTooltip tip={tip} />
      </ChartFrame>
    </Box>
  );
}

/** A bar square at the baseline with a rounded data end (right side). */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M${x},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h - radius}`,
    `Q${x + w},${y + h} ${x + w - radius},${y + h}`,
    `H${x}`,
    "Z",
  ].join(" ");
}
