import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { QualityReport as Report, RejectReason, RowFlag } from "../../lib/clean/types";
import { count, date, FLAG_LABELS, REJECT_LABELS } from "../format";
import { fonts, tokens } from "../theme";

/** What the cleaner did to a file: what it kept, fixed and dropped, in plain words. */
export function QualityReport({ report }: { report: Report }) {
  const fixed = (Object.entries(report.flagged) as [RowFlag, number][]).sort((a, b) => b[1] - a[1]);
  const dropped = (Object.entries(report.rejectedByReason) as [RejectReason, number][]).sort((a, b) => b[1] - a[1]);
  const multiAgent = report.multiAgentSlots
    ? ` ${count(report.multiAgentSlots)} checks were reported by more than one agent; every report is kept.`
    : "";

  return (
    <Box>
      <Typography>
        Kept {count(report.acceptedRows)} of {count(report.totalRows)} rows
        {report.rejectedRows ? ` and dropped ${count(report.rejectedRows)}` : ""}.
        {report.firstCheckAt && report.lastCheckAt
          ? ` The data runs from ${date(report.firstCheckAt)} to ${date(report.lastCheckAt)} (UTC) and covers ` +
            `${report.services.length} services and ${report.agents.length} agents.`
          : ""}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {report.missingSlots === 0
          ? `Every service has a result for every 15-minute check (${count(report.expectedSlots)} checks).`
          : `${count(report.coveredSlots)} of ${count(report.expectedSlots)} checks have a valid result; ` +
            `${count(report.missingSlots)} ${report.missingSlots === 1 ? "has" : "have"} none, because every report ` +
            `for ${report.missingSlots === 1 ? "it" : "them"} was dropped or missing.`}
        {multiAgent}
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 2, md: 4 }, mt: 2 }}>
        <CountList
          title="Fixed, row kept"
          rows={fixed.map(([flag, n]) => [FLAG_LABELS[flag], n])}
          empty="Nothing needed fixing."
        />
        <CountList
          title="Dropped"
          rows={dropped.map(([reason, n]) => [REJECT_LABELS[reason], n])}
          empty="No rows were dropped."
        />
      </Box>
    </Box>
  );
}

function CountList({ title, rows, empty }: { title: string; rows: [string, number][]; empty: string }) {
  return (
    <Box>
      <Typography variant="h3" component="h4" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography color="text.secondary">{empty}</Typography>
      ) : (
        <Box component="dl" sx={{ m: 0 }}>
          {rows.map(([label, n]) => (
            <Box
              key={label}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                py: 0.5,
                borderBottom: `1px solid ${tokens.hairline}`,
              }}
            >
              <Box component="dt">{label}</Box>
              <Box component="dd" sx={{ m: 0, fontFamily: fonts.data, fontVariantNumeric: "tabular-nums" }}>
                {count(n)}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
