import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type Ref } from "react";
import type { DatasetSummary } from "../../lib/apiTypes";
import { api } from "../api";
import { count, date, FLAG_LABELS, time } from "../format";
import { tokens } from "../theme";
import { useAsync } from "../useAsync";
import { TableFrame } from "./StatsTables";

export interface LogFilter {
  service: string; // "" = all services
  failedOnly: boolean;
}

interface Props {
  ref?: Ref<HTMLElement>;
  dataset: DatasetSummary;
  range: { from?: string; to?: string };
  filter: LogFilter;
  onFilterChange: (filter: LogFilter) => void;
}

/** The bottom half: every stored check report for the selected dates, filterable and paged. */
export function LogsSection({ ref, dataset, range, filter, onFilterChange }: Props) {
  const [pageSize, setPageSize] = useState(100);
  // The page resets whenever the filters change; keying it avoids a second fetch for page 0.
  const filterKey = [dataset.id, range.from, range.to, filter.service, filter.failedOnly, pageSize].join("|");
  const [paging, setPaging] = useState({ key: filterKey, page: 0 });
  const page = paging.key === filterKey ? paging.page : 0;

  const logs = useAsync(
    (signal) =>
      api.logs(
        { datasetId: dataset.id, ...range, service: filter.service || undefined, failedOnly: filter.failedOnly, page, pageSize },
        signal,
      ),
    [filterKey, page],
  );

  return (
    <Box component="section" ref={ref} aria-labelledby="logs-heading" sx={{ scrollMarginTop: 80 }}>
      <Typography variant="h2" id="logs-heading" sx={{ fontSize: "1.375rem" }}>
        Check logs
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.25, mb: 1.5 }}>
        Every agent's report is its own row, oldest first. Times are UTC.
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 1.5 }}>
        <TextField
          select
          size="small"
          label="Service"
          value={filter.service}
          onChange={(event) => onFilterChange({ ...filter, service: event.target.value })}
          sx={{ minWidth: 200, bgcolor: tokens.surface }}
        >
          <MenuItem value="">All services</MenuItem>
          {dataset.report.services.map((service) => (
            <MenuItem key={service} value={service}>
              {service}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Switch checked={filter.failedOnly} onChange={(event) => onFilterChange({ ...filter, failedOnly: event.target.checked })} />
          }
          label="Failed checks only"
        />
        {logs.data && (
          <Typography color="text.secondary" sx={{ ml: { md: "auto" } }}>
            {count(logs.data.total)} {logs.data.total === 1 ? "check" : "checks"}
          </Typography>
        )}
      </Box>

      {logs.error && <Alert severity="error" sx={{ mb: 2 }}>Couldn't load the logs. {logs.error}</Alert>}

      {logs.data && logs.data.total === 0 ? (
        <Box sx={{ py: 4 }}>
          <Typography>No checks match these filters.</Typography>
          <Button sx={{ mt: 1, ml: -1 }} onClick={() => onFilterChange({ service: "", failedOnly: false })}>
            Clear service and failure filters
          </Button>
        </Box>
      ) : (
        logs.data && (
          <Box sx={{ opacity: logs.loading ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={logs.loading}>
            <TableFrame label="Check logs">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Agent</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Latency</TableCell>
                  <TableCell>Cleaning notes</TableCell>
                  <TableCell align="right">Line</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.data.rows.map((row) => (
                  <TableRow
                    key={`${row.serviceId}-${row.checkedAt}-${row.agent}`}
                    sx={row.failed ? { bgcolor: tokens.outageWash, "& td:first-of-type": { boxShadow: `inset 3px 0 ${tokens.outage}` } } : undefined}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{date(row.checkedAt)}</TableCell>
                    <TableCell>{time(row.checkedAt)}</TableCell>
                    <TableCell>{row.serviceId}</TableCell>
                    <TableCell>{row.agent}</TableCell>
                    <TableCell>
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        {row.statusCode}
                        {row.failed && (
                          <>
                            <ErrorOutlineIcon sx={{ fontSize: 16, color: tokens.outage }} />
                            <span className="visually-hidden">failed</span>
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{row.latencyMs === null ? "–" : `${count(row.latencyMs)} ms`}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {row.flags.map((flag) => (
                          <Chip key={flag} label={FLAG_LABELS[flag]} size="small" variant="outlined" sx={{ height: 22, borderColor: tokens.grid }} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ color: tokens.muted }}>
                      {row.sourceLine}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableFrame>
            <TablePagination
              component="div"
              count={logs.data.total}
              page={page}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[50, 100, 200]}
              onPageChange={(_event, next) => setPaging({ key: filterKey, page: next })}
              onRowsPerPageChange={(event) => setPageSize(Number(event.target.value))}
              labelRowsPerPage="Rows per page"
            />
          </Box>
        )
      )}
    </Box>
  );
}
