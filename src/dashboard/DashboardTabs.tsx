import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useState, type ReactNode } from "react";
import type { DatasetDetail, OutageView, Stats } from "../../lib/apiTypes";
import { QualityReport } from "../components/QualityReport";
import { count, date, duration, list, month, REJECT_LABELS } from "../format";
import { tokens } from "../theme";
import type { AsyncState } from "../useAsync";
import { ErrorBreakdown } from "./charts/ErrorBreakdown";
import { HealthHeatmap } from "./charts/HealthHeatmap";
import { LatencyTrends } from "./charts/LatencyTrends";
import { ServiceCards } from "./charts/ServiceCards";
import { OutageTimeline } from "./OutageTimeline";
import { OutagesTable, ServiceHealthTable, SlaTable, TableFrame } from "./StatsTables";
import type { TabId } from "./tabs";

export function TabPanel({ id, children }: { id: TabId; children: ReactNode }) {
  return (
    <Box id={`panel-${id}`} sx={{ pb: 4 }}>
      {children}
    </Box>
  );
}

interface StatsTabProps {
  stats: AsyncState<Stats>;
  /** Visible window in ms, [start, end). */
  start: number;
  end: number;
  onOutageSelect: (outage: OutageView) => void;
  onServiceSelect: (serviceId: string) => void;
  onDaySelect: (day: string, serviceId: string) => void;
}

/** Loading, error and refetch states shared by every tab that shows stats. */
function WithStats({ stats, children }: { stats: AsyncState<Stats>; children: (data: Stats) => ReactNode }) {
  if (stats.error) return <Alert severity="error">Couldn't load stats. {stats.error}</Alert>;
  if (!stats.data) return <LinearProgress />;
  if (stats.data.services.length === 0) {
    return <Typography color="text.secondary">No checks in these dates. Pick other dates, or show all dates.</Typography>;
  }
  return (
    // Refetching keeps the previous numbers on screen, dimmed, instead of flashing empty.
    <Box sx={{ opacity: stats.loading ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={stats.loading}>
      {children(stats.data)}
    </Box>
  );
}

export function OverviewTab({ stats, start, end, onServiceSelect, onDaySelect }: StatsTabProps) {
  return (
    <WithStats stats={stats}>
      {(data) => {
        const headline = verdict(data);
        const breached = data.monthly.some((m) => !m.slaMet);
        return (
          <>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "flex-start",
                p: { xs: 2, sm: 2.5 },
                mb: 4,
                borderRadius: 2,
                bgcolor: breached ? tokens.outageWash : tokens.metWash,
                border: `1px solid ${breached ? "#F1C9C3" : "#C9E2D2"}`,
              }}
            >
              {breached ? (
                <ErrorIcon sx={{ fontSize: 30, color: tokens.outage, mt: 0.25 }} />
              ) : (
                <CheckCircleIcon sx={{ fontSize: 30, color: tokens.met, mt: 0.25 }} />
              )}
              <Box>
              <Typography component="p" sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem" }, fontWeight: 700, fontStretch: "112.5%", lineHeight: 1.2 }}>
                {headline.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {headline.detail} {date(new Date(start).toISOString())} to {date(new Date(end - 1).toISOString())}, UTC.
              </Typography>
              </Box>
            </Box>

            <Block title="Service status" note="Worst first. Select a service to see its failed checks." first>
              <ServiceCards stats={data} onSelect={onServiceSelect} />
            </Block>

            <Block title="Daily health" note="Outage downtime per service per UTC day. Select a day to see that service's checks.">
              <HealthHeatmap services={data.services.map((s) => s.serviceId)} daily={data.daily} onSelectDay={onDaySelect} />
            </Block>
          </>
        );
      }}
    </WithStats>
  );
}

export function OutagesTab({ stats, start, end, onOutageSelect }: StatsTabProps) {
  return (
    <WithStats stats={stats}>
      {(data) => (
        <>
          <Block title="Outages over time" note="Select an outage to see its checks in Logs." first>
            <OutageTimeline
              services={data.services.map((s) => s.serviceId)}
              outages={data.outages}
              transientFailures={data.transientFailures}
              start={start}
              end={end}
              onSelect={onOutageSelect}
            />
          </Block>
          <Block
            title={`All outages (${data.outages.length})`}
            note="At least 3 failed checks, with no more than 2 passing checks between failures. Each failed check counts until the next check, 15 minutes later."
          >
            <OutagesTable outages={data.outages} onSelect={onOutageSelect} />
          </Block>
        </>
      )}
    </WithStats>
  );
}

export function CausesTab({ stats, start, end }: StatsTabProps) {
  return (
    <WithStats stats={stats}>
      {(data) => (
        <>
          <Block
            title="Why services failed"
            note="Server errors by status code, from every agent's report, outages and transient errors together."
            first
          >
            <ErrorBreakdown services={data.services} />
          </Block>
          <Block title="Latency over time" note="Each service has its own latency scale. Slowdowns that line up with an outage often point to the cause.">
            <LatencyTrends trends={data.trends} bucketMinutes={data.trendBucketMinutes} outages={data.outages} start={start} end={end} />
          </Block>
          <Block
            title="Service health"
            note="Checks passed counts every failure, including transient ones; availability counts only outages. Latency is over every agent's report."
          >
            <ServiceHealthTable services={data.services} />
          </Block>
        </>
      )}
    </WithStats>
  );
}

export function SlaTab({ stats }: { stats: AsyncState<Stats> }) {
  return (
    <WithStats stats={stats}>
      {(data) => (
        <Block
          title="SLA by month"
          note={`Billing is monthly. Availability = 1 − outage minutes ÷ observed minutes; below ${data.slaTargetPct}% the customer is owed a credit. Allowed is the downtime ${data.slaTargetPct}% permits over the observed minutes.`}
          first
        >
          <SlaTable rows={data.monthly} targetPct={data.slaTargetPct} />
        </Block>
      )}
    </WithStats>
  );
}

export function DataQualityTab({ detail }: { detail: AsyncState<DatasetDetail> }) {
  return (
    <Block title="Cleaning report" note="This covers the whole file, not just the dates selected." first>
      {detail.data ? (
        <>
          <QualityReport report={detail.data.dataset.report} />
          <RejectedRows detail={detail.data} />
        </>
      ) : detail.error ? (
        <Alert severity="error">Couldn't load the data-quality report. {detail.error}</Alert>
      ) : (
        <LinearProgress />
      )}
    </Block>
  );
}

/** The plain-language answer billing and on-call both want first. */
function verdict(stats: Stats): { title: string; detail: string } {
  const target = `${stats.slaTargetPct}%`;
  const downtime = duration(stats.outages.reduce((sum, o) => sum + o.durationMinutes, 0));
  const transient = `${count(stats.transientFailures.length)} transient errors don't count against the SLA.`;
  const breachedMonths = [...new Set(stats.monthly.filter((m) => !m.slaMet).map((m) => m.month))].sort();

  if (breachedMonths.length === 0) {
    return {
      title: `All ${stats.services.length} services met the ${target} SLA.`,
      detail: stats.outages.length ? `${stats.outages.length} outages, ${downtime} of downtime. ${transient}` : `No sustained outages. ${transient}`,
    };
  }
  const title = breachedMonths
    .map((m) => {
      const services = stats.monthly.filter((row) => row.month === m && !row.slaMet).map((row) => row.serviceId);
      return `${list(services)} breached the ${target} SLA in ${month(m)}`;
    })
    .join("; ");
  return {
    title: `${title}.`,
    detail: `${stats.outages.length} ${stats.outages.length === 1 ? "outage" : "outages"}, ${downtime} of downtime in total. ${transient}`,
  };
}

function Block({ title, note, first = false, children }: { title: string; note?: string; first?: boolean; children: ReactNode }) {
  return (
    <Box component="section" sx={first ? undefined : { mt: 5 }}>
      <Typography variant="h2" component="h3">
        {title}
      </Typography>
      {note && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 1.5, maxWidth: "80ch" }}>
          {note}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function RejectedRows({ detail }: { detail: DatasetDetail }) {
  const [open, setOpen] = useState(false);
  const total = detail.dataset.report.rejectedRows;
  if (total === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Button size="small" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Hide dropped rows" : `Show the ${count(total)} dropped rows`}
      </Button>
      {open && (
        <Box sx={{ mt: 1 }}>
          <TableFrame label="Dropped rows">
            <TableHead>
              <TableRow>
                <TableCell align="right">Line</TableCell>
                <TableCell>Why it was dropped</TableCell>
                <TableCell>Row as uploaded</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.rejected.map((row) => (
                <TableRow key={row.sourceLine}>
                  <TableCell align="right">{row.sourceLine}</TableCell>
                  <TableCell>{REJECT_LABELS[row.reason]}</TableCell>
                  <TableCell
                    sx={{
                      fontFamily: "ui-monospace, Consolas, monospace",
                      fontSize: "0.8125rem",
                      whiteSpace: "normal",
                      wordBreak: "break-all",
                      minWidth: 280,
                    }}
                  >
                    {row.raw}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableFrame>
          {total > detail.rejected.length && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Showing the first {count(detail.rejected.length)} of {count(total)}.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
