import Box from "@mui/material/Box";
import { useState, type ReactNode } from "react";
import type { OutageView, Stats } from "../../lib/apiTypes";
import { count, dateTime, duration, time } from "../format";
import { dataType, tokens } from "../theme";
import { LegendKey } from "./charts/chartParts";
import { errorSummary, HIT, timeTicks, useWidth } from "./charts/chartUtils";

const LANE = 34; // lane height
const BAND = 14; // outage band / transient tick height (bars stay under 24px)
const AXIS = 24;

interface Props {
  services: string[];
  outages: OutageView[];
  transientFailures: Stats["transientFailures"];
  /** Visible time window in ms: [start, end). */
  start: number;
  end: number;
  onSelect: (outage: OutageView) => void;
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

/**
 * One lane per service across the selected dates. Outages are bands at their real start and
 * end; transient errors are thin ticks. Nothing is drawn for healthy time, so trouble is the
 * only thing that stands out. The outage and SLA tables below are this chart's table view.
 */
export function OutageTimeline({ services, outages, transientFailures, start, end, onSelect }: Props) {
  const [container, width] = useWidth();
  const [tip, setTip] = useState<Tip | null>(null);
  const [active, setActive] = useState<OutageView | null>(null);

  const labelWidth = width < 600 ? 100 : 112;
  const plotWidth = Math.max(width - labelWidth - 8, 120);
  const x = (ms: number) => labelWidth + ((ms - start) / (end - start)) * plotWidth;
  const height = services.length * LANE + AXIS;
  const laneMid = (serviceId: string) => services.indexOf(serviceId) * LANE + LANE / 2;
  const ticks = timeTicks(start, end, plotWidth);

  function showTip(cx: number, serviceId: string, content: ReactNode) {
    setTip({ x: Math.min(Math.max(cx, 120), width - 120), y: laneMid(serviceId) - LANE / 2, content });
  }

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mb: 1, color: tokens.inkSecondary }}>
        <LegendKey swatch={<rect width="16" height="10" y="2" rx="2" fill={tokens.outage} />}>
          Outage, counts as downtime
        </LegendKey>
        <LegendKey swatch={<rect width="2" height="12" x="7" y="1" rx="1" fill={tokens.transient} />}>
          Transient error, doesn't count
        </LegendKey>
      </Box>

      <Box ref={container} sx={{ position: "relative", bgcolor: tokens.surface, border: `1px solid ${tokens.grid}`, borderRadius: 2, px: 1, py: 1 }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="group"
            aria-label={`Timeline of ${outages.length} outages and ${transientFailures.length} transient errors across ${services.length} services`}
            style={{ display: "block", overflow: "visible", ...dataType }}
            onPointerLeave={() => {
              setTip(null);
              setActive(null);
            }}
          >
            {ticks.map((t) => (
              <g key={t.ms}>
                <line x1={x(t.ms)} x2={x(t.ms)} y1={0} y2={services.length * LANE} stroke={tokens.hairline} />
                <text x={x(t.ms)} y={services.length * LANE + 16} fontSize={12} fill={tokens.muted} textAnchor="middle">
                  {t.label}
                </text>
              </g>
            ))}

            {services.map((serviceId) => (
              <g key={serviceId}>
                <text x={0} y={laneMid(serviceId) + 4} fontSize={13} fill={tokens.ink}>
                  {serviceId}
                </text>
                <line x1={labelWidth} x2={labelWidth + plotWidth} y1={laneMid(serviceId)} y2={laneMid(serviceId)} stroke={tokens.grid} />
              </g>
            ))}

            {transientFailures.map((failure) => {
              const cx = x(Date.parse(failure.checkedAt));
              const mid = laneMid(failure.serviceId);
              return (
                <g
                  key={`${failure.serviceId}-${failure.checkedAt}`}
                  onPointerEnter={() =>
                    showTip(cx, failure.serviceId, (
                      <>
                        <strong>Transient error</strong>
                        <span>{failure.serviceId}</span>
                        <span>{dateTime(failure.checkedAt)} UTC</span>
                      </>
                    ))
                  }
                >
                  <rect x={cx - HIT / 2} y={mid - HIT / 2} width={HIT} height={HIT} fill="transparent" />
                  <rect x={cx - 1} y={mid - BAND / 2} width={2} height={BAND} rx={1} fill={tokens.transient} />
                </g>
              );
            })}

            {outages.map((outage) => {
              const x1 = x(Date.parse(outage.start));
              const bandWidth = Math.max(x(Date.parse(outage.end)) - x1, 4);
              const mid = laneMid(outage.serviceId);
              const label =
                `${outage.serviceId} outage, ${dateTime(outage.start)} to ${time(outage.end)} UTC, ` +
                `${duration(outage.durationMinutes)}, ${outage.failedChecks} of ${outage.observedChecks} checks failed. Show these checks.`;
              const show = () => {
                setActive(outage);
                showTip(x1 + bandWidth / 2, outage.serviceId, (
                  <>
                    <strong>{duration(outage.durationMinutes)} outage</strong>
                    <span>{outage.serviceId}</span>
                    <span>
                      {dateTime(outage.start)} to {time(outage.end)} UTC
                    </span>
                    <span>
                      {count(outage.failedChecks)} of {count(outage.observedChecks)} checks failed
                    </span>
                    <span>Errors: {errorSummary(outage.errorCodes)}</span>
                    <span>Select to see the checks</span>
                  </>
                ));
              };
              return (
                <g
                  key={`${outage.serviceId}-${outage.start}`}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  style={{ cursor: "pointer", outline: "none" }}
                  onPointerEnter={show}
                  onFocus={show}
                  onBlur={() => {
                    setTip(null);
                    setActive(null);
                  }}
                  onClick={() => onSelect(outage)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(outage);
                    }
                  }}
                >
                  <rect
                    x={x1 + bandWidth / 2 - Math.max(bandWidth + 8, HIT) / 2}
                    y={mid - LANE / 2}
                    width={Math.max(bandWidth + 8, HIT)}
                    height={LANE}
                    fill="transparent"
                  />
                  <rect
                    x={x1}
                    y={mid - BAND / 2}
                    width={bandWidth}
                    height={BAND}
                    rx={3}
                    fill={tokens.outage}
                    stroke={active === outage ? tokens.ink : "none"}
                    strokeWidth={2}
                  />
                </g>
              );
            })}
          </svg>
        )}

        {tip && (
          <Box
            role="tooltip"
            sx={{
              position: "absolute",
              left: tip.x,
              top: tip.y,
              transform: "translate(-50%, calc(-100% + 2px))",
              pointerEvents: "none",
              bgcolor: tokens.ink,
              color: "#fff",
              px: 1.25,
              py: 0.75,
              borderRadius: 1,
              fontSize: "0.8125rem",
              lineHeight: 1.4,
              display: "flex",
              flexDirection: "column",
              whiteSpace: "nowrap",
              zIndex: 2,
              "& span": { color: "#C9D3DA" },
            }}
          >
            {tip.content}
          </Box>
        )}
      </Box>
    </Box>
  );
}
