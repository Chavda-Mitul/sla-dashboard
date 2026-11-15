import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import { OutageTimeline } from "./OutageTimeline";
import { OutagesTable, ServiceHealthTable, SlaTable, TableFrame } from "./StatsTables";

interface Props {
  stats: AsyncState<Stats>;
  detail: AsyncState<DatasetDetail>;
  /** Visible window in ms, [start, end). */
  start: number;
  end: number;
  onOutageSelect: (outage: OutageView) => void;
}

/** The collapsible top half: the SLA verdict in words, then the evidence for it. */
export function StatsSection({ stats, detail, start, end, onOutageSelect }: Props) {
  const [expanded, setExpanded] = useState(true);
  const data = stats.data;
  const headline = data ? verdict(data) : { title: "Loading stats…", detail: "" };

  return (
    <Accordion
      expanded={expanded}
      onChange={(_event, isExpanded) => setExpanded(isExpanded)}
      slotProps={{ heading: { component: "h2" } }}
      sx={{ mb: 4 }}
    >
      <AccordionSummary
        aria-controls="stats-content"
        id="stats-header"
        sx={{
          px: 0,
          alignItems: "flex-start",
          "& .MuiAccordionSummary-content": { my: 1, gap: 3, justifyContent: "space-between", alignItems: "flex-start" },
        }}
      >
        <Box>
          <Typography variant="h1" component="span" sx={{ display: "block", maxWidth: "30ch", fontSize: { xs: "1.5rem", sm: "2rem" } }}>
            {headline.title}
          </Typography>
          <Typography color="text.secondary" component="span" sx={{ display: "block", mt: 1, maxWidth: "80ch" }}>
            {headline.detail} {date(new Date(start).toISOString())} to {date(new Date(end - 1).toISOString())}, UTC.
          </Typography>
        </Box>
        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: tokens.petrol, fontWeight: 600, whiteSpace: "nowrap", mt: 0.75 }}
        >
          {expanded ? "Hide stats" : "Show stats"}
          <ExpandMoreIcon sx={{ transition: "transform 150ms", transform: expanded ? "rotate(180deg)" : "none" }} />
        </Box>
      </AccordionSummary>

      <AccordionDetails id="stats-content" sx={{ px: 0 }}>
        {stats.error && <Alert severity="error" sx={{ mb: 2 }}>Couldn't load stats. {stats.error}</Alert>}
        {data && (
          // Refetching keeps the previous numbers on screen, dimmed, instead of flashing empty.
          <Box sx={{ opacity: stats.loading ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={stats.loading}>
            <Block title="Outages over time" note="Select an outage to see its checks in the logs below.">
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
              title="SLA by month"
              note={`Billing is monthly. Availability = 1 − outage minutes ÷ observed minutes; below ${data.slaTargetPct}% the customer is owed a credit. Allowed is the downtime ${data.slaTargetPct}% permits over the observed minutes.`}
            >
              <SlaTable rows={data.monthly} targetPct={data.slaTargetPct} />
            </Block>

            <Block
              title="Outages"
              note="At least 3 failed checks, with no more than 2 passing checks between failures. Each failed check counts until the next check, 15 minutes later."
            >
              <OutagesTable outages={data.outages} onSelect={onOutageSelect} />
            </Block>

            <Block
              title="Service health"
              note="Checks passed counts every failure, including transient ones; availability counts only outages. Latency is over every agent's report."
            >
              <ServiceHealthTable services={data.services} />
            </Block>
          </Box>
        )}

        <Block title="Data quality" note="What the cleaning step did to the uploaded file. This covers the whole file, not just the dates selected.">
          {detail.data ? (
            <>
              <QualityReport report={detail.data.dataset.report} />
              <RejectedRows detail={detail.data} />
            </>
          ) : detail.error ? (
            <Alert severity="error">Couldn't load the data-quality report. {detail.error}</Alert>
          ) : (
            <Typography color="text.secondary">Loading…</Typography>
          )}
        </Block>
      </AccordionDetails>
    </Accordion>
  );
}

/** The plain-language answer billing and on-call both want first. */
function verdict(stats: Stats): { title: string; detail: string } {
  if (stats.services.length === 0) {
    return { title: "No checks in these dates.", detail: "Pick other dates, or show all dates." };
  }
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

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ pt: 2.5, mt: 2.5, borderTop: `1px solid ${tokens.hairline}` }}>
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
