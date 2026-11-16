import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import type { DailyHealth, ServiceStats, Stats } from "../../../lib/apiTypes";
import { count, date, duration, percent } from "../../format";
import { dataType, tokens } from "../../theme";
import { downtimeColor } from "./chartUtils";

type Status = "breached" | "outages" | "healthy";

const STATUS: Record<Status, { label: string; color: string; wash: string; Icon: typeof ErrorIcon }> = {
  breached: { label: "SLA breached", color: tokens.outage, wash: tokens.outageWash, Icon: ErrorIcon },
  outages: { label: "Outages, SLA met", color: tokens.transient, wash: tokens.transientWash, Icon: WarningIcon },
  healthy: { label: "Healthy", color: tokens.met, wash: tokens.metWash, Icon: CheckCircleIcon },
};

/** Column template shared by the header and every row (wide screens). */
const COLUMNS = "160px minmax(110px, 1fr) 100px 92px 70px 100px minmax(180px, 2fr)";

interface Props {
  stats: Stats;
  onSelect: (serviceId: string) => void;
}

/**
 * A status board: one row per service, worst first, so "which server is down?" reads top-down.
 * Status is an icon and a label, never color alone. The strip is one cell per day, by downtime.
 */
export function ServiceCards({ stats, onSelect }: Props) {
  const breached = new Set(stats.monthly.filter((m) => !m.slaMet).map((m) => m.serviceId));
  const order: Record<Status, number> = { breached: 0, outages: 1, healthy: 2 };
  const statusOf = (s: ServiceStats): Status => (breached.has(s.serviceId) ? "breached" : s.outages > 0 ? "outages" : "healthy");
  const services = [...stats.services].sort(
    (a, b) => order[statusOf(a)] - order[statusOf(b)] || (a.availabilityPct ?? 100) - (b.availabilityPct ?? 100),
  );

  return (
    <Box sx={{ bgcolor: tokens.surface, border: `1px solid ${tokens.grid}`, borderRadius: 2, overflow: "hidden" }}>
      <Box
        aria-hidden="true"
        sx={{
          display: { xs: "none", lg: "grid" },
          gridTemplateColumns: COLUMNS,
          columnGap: 2,
          px: 2,
          py: 1,
          bgcolor: "#F6F8FB",
          borderBottom: `1px solid ${tokens.hairline}`,
          color: tokens.inkSecondary,
          fontSize: "0.8125rem",
          fontWeight: 600,
          "& > :nth-of-type(n+3):nth-of-type(-n+6)": { textAlign: "right" },
        }}
      >
        <span>Status</span>
        <span>Service</span>
        <span>Availability</span>
        <span>Downtime</span>
        <span>Outages</span>
        <span>Main error</span>
        <span>Downtime by day</span>
      </Box>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {services.map((s) => (
          <Row
            key={s.serviceId}
            service={s}
            status={statusOf(s)}
            targetPct={stats.slaTargetPct}
            daily={stats.daily.filter((d) => d.serviceId === s.serviceId)}
            onSelect={() => onSelect(s.serviceId)}
          />
        ))}
      </Box>
    </Box>
  );
}

function Row({
  service: s,
  status,
  targetPct,
  daily,
  onSelect,
}: {
  service: ServiceStats;
  status: Status;
  targetPct: number;
  daily: DailyHealth[];
  onSelect: () => void;
}) {
  const { label, color, wash, Icon } = STATUS[status];
  const topCode = Object.entries(s.statusCodes)
    .filter(([code]) => Number(code) >= 500)
    .sort((a, b) => b[1] - a[1])[0];
  const mainError = topCode ? `${topCode[0]} × ${count(topCode[1])}` : "none";
  const belowTarget = s.availabilityPct !== null && s.availabilityPct < targetPct;

  return (
    <Box component="li" sx={{ "& + &": { borderTop: `1px solid ${tokens.hairline}` } }}>
      <ButtonBase
        onClick={onSelect}
        aria-label={`${s.serviceId}: ${label}, availability ${percent(s.availabilityPct)}, ${duration(s.downtimeMinutes)} down. Show its failed checks.`}
        sx={{
          width: "100%",
          textAlign: "left",
          display: "grid",
          alignItems: "center",
          columnGap: 2,
          rowGap: 1,
          px: 2,
          py: 1.5,
          gridTemplateColumns: { xs: "1fr auto", lg: COLUMNS },
          gridTemplateAreas: {
            xs: `"name avail" "status status" "facts facts" "strip strip"`,
            lg: `"status name avail down outages error strip"`,
          },
          "&:hover": { bgcolor: "#F7F9FC" },
          "&.Mui-focusVisible": { outline: `2px solid ${tokens.accent}`, outlineOffset: -2 },
        }}
      >
        <Box
          sx={{
            gridArea: "status",
            justifySelf: "start",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            bgcolor: wash,
            borderRadius: 999,
            pl: 0.75,
            pr: 1.25,
            py: 0.25,
          }}
        >
          <Icon sx={{ fontSize: 17, color }} />
          <Box component="span" sx={{ fontSize: "0.8125rem", fontWeight: 650, color: tokens.ink, whiteSpace: "nowrap" }}>
            {label}
          </Box>
        </Box>

        <Box sx={{ gridArea: "name", minWidth: 0 }}>
          <Box sx={{ fontWeight: 650 }}>{s.serviceId}</Box>
          <Box sx={{ fontSize: "0.8125rem", color: tokens.muted }}>{s.serviceName}</Box>
        </Box>

        <Box sx={{ gridArea: "avail", textAlign: "right" }}>
          <Box sx={{ ...dataType, fontSize: "1.375rem", fontWeight: 700, lineHeight: 1.1, color: belowTarget ? tokens.outage : tokens.ink }}>
            {percent(s.availabilityPct)}
          </Box>
          <Box sx={{ fontSize: "0.75rem", color: tokens.muted, display: { lg: "none" } }}>availability</Box>
        </Box>

        <Fact area="down" value={duration(s.downtimeMinutes)} />
        <Fact area="outages" value={count(s.outages)} />
        <Fact area="error" value={mainError} />

        {/* Narrow screens: the three facts share one line. */}
        <Box sx={{ gridArea: "facts", display: { xs: "flex", lg: "none" }, flexWrap: "wrap", columnGap: 2.5, ...dataType, fontSize: "0.875rem", color: tokens.inkSecondary }}>
          <span>{duration(s.downtimeMinutes)} down</span>
          <span>
            {count(s.outages)} {s.outages === 1 ? "outage" : "outages"}
          </span>
          <span>{topCode ? `Main error ${mainError}` : "No server errors"}</span>
        </Box>

        <DayStrip daily={daily} />
      </ButtonBase>
    </Box>
  );
}

function Fact({ area, value }: { area: string; value: string }) {
  return <Box sx={{ gridArea: area, display: { xs: "none", lg: "block" }, textAlign: "right", ...dataType, fontSize: "0.9375rem" }}>{value}</Box>;
}

/** A tiny heatmap row: one cell per day. Gray is a day without downtime. */
function DayStrip({ daily }: { daily: DailyHealth[] }) {
  if (daily.length === 0) return <Box sx={{ gridArea: "strip" }} />;
  const worst = daily.reduce((a, b) => (b.downtimeMinutes > a.downtimeMinutes ? b : a));
  return (
    <Box sx={{ gridArea: "strip", minWidth: 0 }}>
      <Box sx={{ display: "flex", gap: "2px", height: 14 }} aria-hidden="true">
        {daily.map((d) => (
          <Box key={d.day} sx={{ flex: 1, maxWidth: 28, borderRadius: "2px", bgcolor: downtimeColor(d.downtimeMinutes) }} />
        ))}
      </Box>
      <Box sx={{ fontSize: "0.75rem", color: tokens.muted, mt: 0.5 }}>
        {worst.downtimeMinutes > 0
          ? `Worst: ${date(`${worst.day}T00:00:00Z`)}, ${duration(worst.downtimeMinutes)} down`
          : `${daily.length} ${daily.length === 1 ? "day" : "days"}, no downtime`}
      </Box>
    </Box>
  );
}
