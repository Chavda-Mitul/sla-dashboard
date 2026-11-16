import Box from "@mui/material/Box";
import { useState } from "react";
import type { DailyHealth } from "../../../lib/apiTypes";
import { count, date, duration, percent, shortDate } from "../../format";
import { dataType, tokens } from "../../theme";
import { ChartFrame, ChartTooltip, Legend, LegendKey } from "./chartParts";
import { clampTipX, DOWNTIME_BINS, downtimeColor, useWidth, type Tip } from "./chartUtils";

const ROW = 28;
const AXIS = 22;
const GAP = 2; // surface gap between cells

interface Props {
  services: string[];
  daily: DailyHealth[];
  onSelectDay: (day: string, serviceId: string) => void;
}

/**
 * Service × day grid: which server was down on which day. Cell color is outage downtime that day;
 * a small amber dot marks a day with only transient errors. Select a cell to open that day.
 */
export function HealthHeatmap({ services, daily, onSelectDay }: Props) {
  const [frame, width] = useWidth();
  const [tip, setTip] = useState<Tip | null>(null);
  const days = [...new Set(daily.map((d) => d.day))].sort();
  const cells = new Map(daily.map((d) => [`${d.serviceId}|${d.day}`, d]));

  const labelWidth = width < 600 ? 84 : 108;
  const plotWidth = Math.max(width - labelWidth, 60);
  // Capped so one or two days read as cells, not a solid block across the chart.
  const cellWidth = Math.min(days.length ? plotWidth / days.length : plotWidth, 64);
  const labelEvery = Math.max(1, Math.ceil(52 / cellWidth));
  const height = services.length * ROW + AXIS;

  return (
    <Box>
      <Legend>
        {DOWNTIME_BINS.map((bin) => (
          <LegendKey key={bin.label} swatch={<rect width="14" height="12" y="1" rx="2" fill={bin.color} />}>
            {bin.label === "None" ? "No downtime" : bin.label}
          </LegendKey>
        ))}
        <LegendKey swatch={<circle cx="7" cy="7" r="3.5" fill={tokens.transient} />}>Transient errors only</LegendKey>
      </Legend>

      <ChartFrame frameRef={frame}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="grid"
            aria-label={`Daily downtime for ${services.length} services over ${days.length} days`}
            style={{ display: "block", overflow: "visible", ...dataType }}
            onPointerLeave={() => setTip(null)}
          >
            {services.map((serviceId, row) => (
              <g key={serviceId} role="row">
                <text x={0} y={row * ROW + ROW / 2 + 4} fontSize={13} fill={tokens.ink}>
                  {serviceId}
                </text>
                {days.map((day, col) => {
                  const cell = cells.get(`${serviceId}|${day}`);
                  const x = labelWidth + col * cellWidth;
                  const y = row * ROW;
                  const transientOnly = cell && cell.downtimeMinutes === 0 && cell.failedChecks > 0;
                  const describe = cell
                    ? `${serviceId}, ${date(`${day}T00:00:00Z`)}: ${cell.downtimeMinutes > 0 ? `${duration(cell.downtimeMinutes)} of downtime` : "no downtime"}, ${cell.failedChecks} failed checks. Open this day.`
                    : `${serviceId}, ${date(`${day}T00:00:00Z`)}: no data`;
                  const show = () =>
                    setTip({
                      x: clampTipX(x + cellWidth / 2, width),
                      y,
                      content: cell ? (
                        <>
                          <strong>
                            {serviceId}, {date(`${day}T00:00:00Z`)}
                          </strong>
                          <span>{cell.downtimeMinutes > 0 ? `${duration(cell.downtimeMinutes)} down` : "No downtime"}</span>
                          <span>Availability {percent(cell.availabilityPct)}</span>
                          <span>
                            {count(cell.failedChecks)} of {count(cell.observedChecks)} checks failed
                          </span>
                          <span>Select to open this day</span>
                        </>
                      ) : (
                        <strong>No data</strong>
                      ),
                    });
                  return (
                    <g
                      key={day}
                      role="gridcell"
                      tabIndex={cell ? 0 : -1}
                      aria-label={describe}
                      style={{ cursor: cell ? "pointer" : "default", outline: "none" }}
                      onPointerEnter={show}
                      onFocus={show}
                      onBlur={() => setTip(null)}
                      onClick={() => cell && onSelectDay(day, serviceId)}
                      onKeyDown={(event) => {
                        if (cell && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onSelectDay(day, serviceId);
                        }
                      }}
                    >
                      <rect
                        x={x + GAP / 2}
                        y={y + GAP / 2}
                        width={Math.max(cellWidth - GAP, 1)}
                        height={ROW - GAP}
                        rx={3}
                        fill={cell ? downtimeColor(cell.downtimeMinutes) : tokens.surface}
                        stroke={cell ? "none" : tokens.hairline}
                      />
                      {transientOnly && <circle cx={x + cellWidth / 2} cy={y + ROW / 2} r={Math.min(3.5, cellWidth / 4)} fill={tokens.transient} />}
                    </g>
                  );
                })}
              </g>
            ))}
            {days.map((day, col) =>
              col % labelEvery === 0 ? (
                <text
                  key={day}
                  x={labelWidth + col * cellWidth + cellWidth / 2}
                  y={services.length * ROW + 16}
                  fontSize={12}
                  fill={tokens.muted}
                  textAnchor="middle"
                >
                  {shortDate(`${day}T00:00:00Z`)}
                </text>
              ) : null,
            )}
          </svg>
        )}
        <ChartTooltip tip={tip} />
      </ChartFrame>
    </Box>
  );
}
