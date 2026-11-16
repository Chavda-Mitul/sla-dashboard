import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import type { DatasetSummary, OutageView } from "../../lib/apiTypes";
import { api } from "../api";
import { isoDay } from "../format";
import { useAsync } from "../useAsync";
import { CausesTab, DataQualityTab, OutagesTab, OverviewTab, SlaTab, TabPanel } from "./DashboardTabs";
import { rangeOf, type DateFilter } from "./dateFilter";
import { FilterBar } from "./FilterBar";
import { LogsSection, type LogFilter } from "./LogsSection";
import { TAB_LABELS, type NavCounts, type TabId } from "./tabs";

const DAY = 86_400_000;
const SLOT = 15 * 60_000;

const TAB_INTROS: Record<TabId, string> = {
  overview: "Which services are down, and on which days.",
  outages: "Every sustained outage, when it started and what errors it threw.",
  causes: "What the failures were, and how response times moved around them.",
  sla: "Availability per service per calendar month, and who is owed a credit.",
  logs: "Every agent's report as its own row, oldest first. Times are UTC; latency is in milliseconds.",
  quality: "What the cleaning step kept, fixed and dropped from the uploaded file.",
};

interface Props {
  datasetId: string | null;
  filter: DateFilter;
  tab: TabId;
  onTabChange: (tab: TabId) => void;
  onCountsChange: (counts: NavCounts) => void;
  onDatasetChange: (id: string) => void;
  onFilterChange: (filter: DateFilter) => void;
  onUploadClick: () => void;
}

export function DashboardView({ datasetId, onUploadClick, ...rest }: Props) {
  const datasets = useAsync((signal) => api.datasets(signal), []);
  const list = datasets.data?.datasets ?? [];

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
  return <DatasetDashboard key={dataset.id} dataset={dataset} datasets={list} {...rest} />;
}

interface DatasetDashboardProps extends Omit<Props, "datasetId" | "onUploadClick"> {
  dataset: DatasetSummary;
  datasets: DatasetSummary[];
}

function DatasetDashboard({ dataset, datasets, filter, tab, onTabChange, onCountsChange, onDatasetChange, onFilterChange }: DatasetDashboardProps) {
  const range = rangeOf(filter);
  const [logFilter, setLogFilter] = useState<LogFilter>({ service: "", failedOnly: false });

  const stats = useAsync((signal) => api.stats({ datasetId: dataset.id, ...range }, signal), [dataset.id, range.from, range.to]);
  const detail = useAsync((signal) => api.dataset(dataset.id, signal), [dataset.id]);

  // Counts beside the section names in the navigation.
  useEffect(() => {
    const outages = stats.data?.outages.length ?? 0;
    const breaches = stats.data?.monthly.filter((m) => !m.slaMet).length ?? 0;
    const dropped = detail.data?.dataset.report.rejectedRows ?? 0;
    onCountsChange({
      outages: { value: outages, alert: outages > 0 },
      sla: { value: breaches, alert: breaches > 0 },
      quality: { value: dropped, alert: false },
    });
  }, [stats.data, detail.data, onCountsChange]);

  const firstCheck = Date.parse(dataset.firstCheckAt ?? dataset.uploadedAt);
  const lastCheck = Date.parse(dataset.lastCheckAt ?? dataset.uploadedAt);
  const start = range.from ? Date.parse(`${range.from}T00:00:00Z`) : firstCheck;
  const end = range.to ? Date.parse(`${range.to}T00:00:00Z`) + DAY : lastCheck + SLOT;

  function openTab(next: TabId) {
    onTabChange(next);
    window.scrollTo({ top: 0 });
  }

  /** From an outage to its evidence: that day, that service, in the logs. */
  function showOutage(outage: OutageView) {
    showDay(isoDay(outage.start), outage.serviceId);
  }

  /** A heatmap cell: that day, that service, in the logs. */
  function showDay(day: string, serviceId: string) {
    onFilterChange({ mode: "day", from: day, to: day });
    setLogFilter({ service: serviceId, failedOnly: false });
    openTab("logs");
  }

  /** A service row: that service's failed checks, keeping the current dates. */
  function showService(serviceId: string) {
    setLogFilter({ service: serviceId, failedOnly: true });
    openTab("logs");
  }

  const tabProps = { stats, start, end, onOutageSelect: showOutage, onServiceSelect: showService, onDaySelect: showDay };

  return (
    <>
      <Box component="header" sx={{ pt: { xs: 3, md: 4 }, pb: 3 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 3, rowGap: 1.5 }}>
          <Typography variant="h1">{TAB_LABELS[tab]}</Typography>
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
          {TAB_INTROS[tab]}
        </Typography>
      </Box>

      <TabPanel id={tab}>
        {tab === "overview" && <OverviewTab {...tabProps} />}
        {tab === "outages" && <OutagesTab {...tabProps} />}
        {tab === "causes" && <CausesTab {...tabProps} />}
        {tab === "sla" && <SlaTab stats={stats} />}
        {tab === "logs" && <LogsSection dataset={dataset} range={range} filter={logFilter} onFilterChange={setLogFilter} />}
        {tab === "quality" && <DataQualityTab detail={detail} />}
      </TabPanel>
    </>
  );
}
