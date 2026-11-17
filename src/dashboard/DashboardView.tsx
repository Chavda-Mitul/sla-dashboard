import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";
import type { DatasetSummary, OutageView } from "../../lib/apiTypes";
import { api } from "../api";
import { isoDay } from "../format";
import { useAsync } from "../useAsync";
import { rangeOf, type DateFilter } from "./dateFilter";
import { FilterBar } from "./FilterBar";
import { LogsSection, type LogFilter } from "./LogsSection";
import { StatsSection } from "./StatsSection";
import type { TabId } from "./tabs";

const DAY = 86_400_000;
const SLOT = 15 * 60_000;

interface Props {
  datasetId: string | null;
  filter: DateFilter;
  tab: TabId;
  onTabChange: (tab: TabId) => void;
  onDatasetChange: (id: string) => void;
  onFilterChange: (filter: DateFilter) => void;
  onUploadClick: () => void;
}

export function DashboardView({ datasetId, onUploadClick, ...rest }: Props) {
  const datasets = useAsync((signal) => api.datasets(signal), []);
  const list = datasets.data?.datasets ?? [];
  // Lives here, above the per-dataset view, so switching datasets doesn't reopen hidden stats.
  const [statsExpanded, setStatsExpanded] = useState(true);

  if (!datasets.data) {
    return (
      <Box sx={{ pt: 4 }}>
        {datasets.error ? <Alert severity="error">Couldn't load datasets. {datasets.error}</Alert> : <LinearProgress />}
      </Box>
    );
  }

  if (list.length === 0) {
    return (
      <Box sx={{ py: 8, maxWidth: 560 }}>
        <Typography variant="h1" sx={{ mb: 1 }}>
          No data yet
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>
          Upload a CSV of health checks to see SLA results, outages and the check logs.
        </Typography>
        <Button variant="contained" onClick={onUploadClick}>
          Upload CSV
        </Button>
      </Box>
    );
  }

  // An unknown id in the URL (e.g. an old link) falls back to the newest upload.
  const dataset = list.find((d) => d.id === datasetId) ?? list[0]!;
  return (
    <DatasetDashboard
      key={dataset.id}
      dataset={dataset}
      datasets={list}
      statsExpanded={statsExpanded}
      onStatsExpandedChange={setStatsExpanded}
      {...rest}
    />
  );
}

interface DatasetDashboardProps extends Omit<Props, "datasetId" | "onUploadClick"> {
  dataset: DatasetSummary;
  datasets: DatasetSummary[];
  statsExpanded: boolean;
  onStatsExpandedChange: (expanded: boolean) => void;
}

/**
 * One page, top to bottom: the filters that scope everything below them, the collapsible stats,
 * then the check logs. Stats and logs always describe the same dates.
 */
function DatasetDashboard({
  dataset,
  datasets,
  filter,
  tab,
  onTabChange,
  onDatasetChange,
  onFilterChange,
  statsExpanded,
  onStatsExpandedChange,
}: DatasetDashboardProps) {
  const range = rangeOf(filter);
  const [logFilter, setLogFilter] = useState<LogFilter>({ service: "", failedOnly: false });
  const logsRef = useRef<HTMLElement>(null);

  const stats = useAsync((signal) => api.stats({ datasetId: dataset.id, ...range }, signal), [dataset.id, range.from, range.to]);
  const detail = useAsync((signal) => api.dataset(dataset.id, signal), [dataset.id]);

  const firstCheck = Date.parse(dataset.firstCheckAt ?? dataset.uploadedAt);
  const lastCheck = Date.parse(dataset.lastCheckAt ?? dataset.uploadedAt);
  const start = range.from ? Date.parse(`${range.from}T00:00:00Z`) : firstCheck;
  const end = range.to ? Date.parse(`${range.to}T00:00:00Z`) + DAY : lastCheck + SLOT;

  function scrollToLogs() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    logsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  /** From an outage to its evidence: that day, that service, in the logs. */
  function showOutage(outage: OutageView) {
    showDay(isoDay(outage.start), outage.serviceId);
  }

  /** A heatmap cell: that day, that service, in the logs. */
  function showDay(day: string, serviceId: string) {
    onFilterChange({ mode: "day", from: day, to: day });
    setLogFilter({ service: serviceId, failedOnly: false });
    scrollToLogs();
  }

  /** A service card: that service's failed checks, keeping the current dates. */
  function showService(serviceId: string) {
    setLogFilter({ service: serviceId, failedOnly: true });
    scrollToLogs();
  }

  return (
    <>
      <Box component="header" sx={{ pt: { xs: 3, md: 4 }, pb: 3 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 3, rowGap: 1.5 }}>
          <Typography variant="h1">SLA dashboard</Typography>
          <FilterBar
            datasets={datasets}
            datasetId={dataset.id}
            onDatasetChange={onDatasetChange}
            filter={filter}
            onFilterChange={onFilterChange}
            minDay={isoDay(new Date(firstCheck).toISOString())}
            maxDay={isoDay(new Date(lastCheck).toISOString())}
          />
        </Box>
        <Typography color="text.secondary" sx={{ mt: { xs: 1.5, md: 0.25 } }}>
          Stats for the selected dates, then the check logs behind them. All times are UTC.
        </Typography>
      </Box>

      <StatsSection
        stats={stats}
        detail={detail}
        expanded={statsExpanded}
        onExpandedChange={onStatsExpandedChange}
        tab={tab}
        onTabChange={onTabChange}
        start={start}
        end={end}
        onOutageSelect={showOutage}
        onServiceSelect={showService}
        onDaySelect={showDay}
      />

      <LogsSection ref={logsRef} dataset={dataset} range={range} filter={logFilter} onFilterChange={setLogFilter} />
    </>
  );
}
