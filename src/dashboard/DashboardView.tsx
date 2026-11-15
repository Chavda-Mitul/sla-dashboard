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

const DAY = 86_400_000;
const SLOT = 15 * 60_000;

interface Props {
  datasetId: string | null;
  filter: DateFilter;
  onDatasetChange: (id: string) => void;
  onFilterChange: (filter: DateFilter) => void;
  onUploadClick: () => void;
}

export function DashboardView({ datasetId, filter, onDatasetChange, onFilterChange, onUploadClick }: Props) {
  const datasets = useAsync((signal) => api.datasets(signal), []);
  const list = datasets.data?.datasets ?? [];

  if (!datasets.data) {
    return datasets.error ? <Alert severity="error">Couldn't load datasets. {datasets.error}</Alert> : <LinearProgress />;
  }

  if (list.length === 0) {
    return (
      <Box sx={{ py: 6, maxWidth: 560 }}>
        <Typography variant="h1" sx={{ fontSize: "1.5rem", mb: 1 }}>
          No data yet
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
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
      filter={filter}
      onDatasetChange={onDatasetChange}
      onFilterChange={onFilterChange}
    />
  );
}

interface DatasetDashboardProps {
  dataset: DatasetSummary;
  datasets: DatasetSummary[];
  filter: DateFilter;
  onDatasetChange: (id: string) => void;
  onFilterChange: (filter: DateFilter) => void;
}

function DatasetDashboard({ dataset, datasets, filter, onDatasetChange, onFilterChange }: DatasetDashboardProps) {
  const range = rangeOf(filter);
  const [logFilter, setLogFilter] = useState<LogFilter>({ service: "", failedOnly: false });
  const logsRef = useRef<HTMLElement>(null);

  const stats = useAsync((signal) => api.stats({ datasetId: dataset.id, ...range }, signal), [dataset.id, range.from, range.to]);
  const detail = useAsync((signal) => api.dataset(dataset.id, signal), [dataset.id]);

  const firstCheck = Date.parse(dataset.firstCheckAt ?? dataset.uploadedAt);
  const lastCheck = Date.parse(dataset.lastCheckAt ?? dataset.uploadedAt);
  const start = range.from ? Date.parse(`${range.from}T00:00:00Z`) : firstCheck;
  const end = range.to ? Date.parse(`${range.to}T00:00:00Z`) + DAY : lastCheck + SLOT;

  /** From an outage to its evidence: that day, that service, in the logs. */
  function showOutage(outage: OutageView) {
    const day = isoDay(outage.start);
    onFilterChange({ mode: "day", from: day, to: day });
    setLogFilter({ service: outage.serviceId, failedOnly: false });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    logsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <>
      <FilterBar
        datasets={datasets}
        datasetId={dataset.id}
        onDatasetChange={onDatasetChange}
        filter={filter}
        onFilterChange={onFilterChange}
        minDay={isoDay(new Date(firstCheck).toISOString())}
        maxDay={isoDay(new Date(lastCheck).toISOString())}
      />
      <StatsSection stats={stats} detail={detail} start={start} end={end} onOutageSelect={showOutage} />
      <LogsSection ref={logsRef} dataset={dataset} range={range} filter={logFilter} onFilterChange={setLogFilter} />
    </>
  );
}
