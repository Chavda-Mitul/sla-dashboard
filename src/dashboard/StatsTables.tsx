import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import type { MonthlySla, OutageView, ServiceStats } from "../../lib/apiTypes";
import { SlaResult } from "../components/SlaResult";
import { count, date, duration, month, percent, time } from "../format";
import { tokens } from "../theme";
import { errorSummary } from "./charts/chartUtils";

export function TableFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    // position: relative keeps absolutely positioned screen-reader text inside the scrolling frame,
    // so a wide table can't widen the page on a phone.
    <TableContainer sx={{ position: "relative", bgcolor: tokens.surface, border: `1px solid ${tokens.grid}`, borderRadius: 2 }}>
      <Table size="small" aria-label={label}>
        {children}
      </Table>
    </TableContainer>
  );
}

/** Billing view: one row per service per calendar month, judged against the SLA target. */
export function SlaTable({ rows, targetPct }: { rows: MonthlySla[]; targetPct: number }) {
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month) || a.serviceId.localeCompare(b.serviceId));
  return (
    <TableFrame label="SLA by month">
      <TableHead>
        <TableRow>
          <TableCell>Service</TableCell>
          <TableCell>Month</TableCell>
          <TableCell align="right">Availability</TableCell>
          <TableCell align="right">Downtime</TableCell>
          <TableCell align="right">Allowed</TableCell>
          <TableCell align="right">Left</TableCell>
          <TableCell>Result vs {targetPct}%</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sorted.map((row) => {
          const [year, monthNumber] = row.month.split("-").map(Number) as [number, number];
          const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
          // One decimal, but a whole number when it rounds to one (863 of 864 checks reads "9", not "9.0").
          const observedDays = Math.round((row.observedMinutes / 1440) * 10) / 10;
          return (
            <TableRow key={`${row.serviceId}-${row.month}`} sx={{ bgcolor: row.slaMet ? undefined : tokens.outageWash }}>
              <TableCell>{row.serviceId}</TableCell>
              <TableCell>
                {month(row.month)}
                {observedDays < daysInMonth && (
                  <Typography component="span" variant="body2" sx={{ color: tokens.muted, ml: 1 }}>
                    {observedDays} of {daysInMonth} days observed
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">{percent(row.availabilityPct)}</TableCell>
              <TableCell align="right">{duration(row.downtimeMinutes)}</TableCell>
              <TableCell align="right">{duration(row.errorBudgetMinutes)}</TableCell>
              <TableCell align="right">
                {row.errorBudgetLeftMinutes >= 0
                  ? duration(row.errorBudgetLeftMinutes)
                  : `Over by ${duration(-row.errorBudgetLeftMinutes)}`}
              </TableCell>
              <TableCell>
                <SlaResult met={row.slaMet} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </TableFrame>
  );
}

export function OutagesTable({ outages, onSelect }: { outages: OutageView[]; onSelect: (outage: OutageView) => void }) {
  if (outages.length === 0) {
    return <Typography color="text.secondary">No sustained outages in these dates.</Typography>;
  }
  return (
    <TableFrame label="Outages">
      <TableHead>
        <TableRow>
          <TableCell>Service</TableCell>
          <TableCell>Date</TableCell>
          <TableCell>Time (UTC)</TableCell>
          <TableCell align="right">Duration</TableCell>
          <TableCell align="right">Failed checks</TableCell>
          <TableCell>Errors seen</TableCell>
          <TableCell>
            <span className="visually-hidden">Logs</span>
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {outages.map((outage) => (
          <TableRow key={`${outage.serviceId}-${outage.start}`}>
            <TableCell>{outage.serviceId}</TableCell>
            <TableCell>{date(outage.start)}</TableCell>
            <TableCell>
              {time(outage.start)} to {time(outage.end)}
            </TableCell>
            <TableCell align="right">{duration(outage.durationMinutes)}</TableCell>
            <TableCell align="right">
              {count(outage.failedChecks)} of {count(outage.observedChecks)}
            </TableCell>
            <TableCell>{errorSummary(outage.errorCodes)}</TableCell>
            <TableCell>
              <Button size="small" onClick={() => onSelect(outage)}>
                Show checks
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </TableFrame>
  );
}

/** On-call view: how each service behaved over the selected dates. */
export function ServiceHealthTable({ services }: { services: ServiceStats[] }) {
  return (
    <TableFrame label="Service health">
      <TableHead>
        <TableRow>
          <TableCell>Service</TableCell>
          <TableCell align="right">Availability</TableCell>
          <TableCell align="right">Checks passed</TableCell>
          <TableCell align="right">Outages</TableCell>
          <TableCell align="right">Transient errors</TableCell>
          <TableCell align="right">Latency p50</TableCell>
          <TableCell align="right">p95</TableCell>
          <TableCell align="right">p99</TableCell>
          <TableCell align="right">Agents disagreed</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {services.map((s) => (
          <TableRow key={s.serviceId}>
            <TableCell>
              {s.serviceId}
              <Typography component="span" variant="body2" sx={{ color: tokens.muted, ml: 1 }}>
                {s.serviceName}
              </Typography>
            </TableCell>
            <TableCell align="right">{percent(s.availabilityPct)}</TableCell>
            <TableCell align="right">{percent(s.rawSuccessPct, 2)}</TableCell>
            <TableCell align="right">{count(s.outages)}</TableCell>
            <TableCell align="right">{count(s.transientFailures)}</TableCell>
            <TableCell align="right">{ms(s.latencyMs.p50)}</TableCell>
            <TableCell align="right">{ms(s.latencyMs.p95)}</TableCell>
            <TableCell align="right">{ms(s.latencyMs.p99)}</TableCell>
            <TableCell align="right">{count(s.agentDisagreements)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </TableFrame>
  );
}

const ms = (value: number | null) => (value === null ? "–" : `${count(value)} ms`);
