import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import type { DatasetDetail, OutageView, Stats } from "../../lib/apiTypes";
import { dataType, tokens } from "../theme";
import type { AsyncState } from "../useAsync";
import { CausesTab, DataQualityTab, OutagesTab, OverviewTab, SlaTab, StatsSummary, TabPanel, VerdictLine } from "./DashboardTabs";
import { TAB_IDS, TAB_LABELS, type TabCounts, type TabId } from "./tabs";

interface Props {
  stats: AsyncState<Stats>;
  detail: AsyncState<DatasetDetail>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  tab: TabId;
  onTabChange: (tab: TabId) => void;
  /** Visible window in ms, [start, end). */
  start: number;
  end: number;
  onOutageSelect: (outage: OutageView) => void;
  onServiceSelect: (serviceId: string) => void;
  onDaySelect: (day: string, serviceId: string) => void;
}

/**
 * The collapsible top half of the dashboard: the SLA verdict and headline numbers, then one view
 * at a time of the evidence behind them. The views are tabs so the section stays short and the
 * logs below it stay in reach. Collapsed, it keeps the verdict as one line.
 */
export function StatsSection({ stats, detail, expanded, onExpandedChange, tab, onTabChange, start, end, ...handlers }: Props) {
  const tabProps = { stats, start, end, ...handlers };
  const outages = stats.data?.outages.length ?? 0;
  const breaches = stats.data?.monthly.filter((m) => !m.slaMet).length ?? 0;
  const counts: TabCounts = {
    outages: { value: outages, alert: outages > 0 },
    sla: { value: breaches, alert: breaches > 0 },
    quality: { value: detail.data?.dataset.report.rejectedRows ?? 0, alert: false },
  };

  return (
    <Box component="section" aria-labelledby="stats-heading" sx={{ mb: 6 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          pb: 1.5,
          mb: expanded ? 2.5 : 0,
          borderBottom: `1px solid ${tokens.grid}`,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" id="stats-heading">
            Stats
          </Typography>
          {!expanded && stats.data && <VerdictLine stats={stats.data} />}
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-controls="stats-content"
          endIcon={<ExpandMoreIcon sx={{ transition: "transform 150ms", transform: expanded ? "rotate(180deg)" : "none" }} />}
          sx={{ flexShrink: 0, borderColor: tokens.grid, color: tokens.ink, "&:hover": { borderColor: "#D1D5DB", bgcolor: tokens.subtle } }}
        >
          {expanded ? "Hide stats" : "Show stats"}
        </Button>
      </Box>

      <Collapse in={expanded} id="stats-content">
        <StatsSummary stats={stats} start={start} end={end} />

        <Tabs
          value={tab}
          onChange={(_event, next: TabId) => onTabChange(next)}
          variant="scrollable"
          scrollButtons={false}
          textColor="inherit"
          aria-label="Stats views"
          sx={{
            mt: 3,
            minHeight: 44,
            borderBottom: `1px solid ${tokens.grid}`,
            "& .MuiTabs-indicator": { bgcolor: tokens.ink, height: 2, borderRadius: 2 },
          }}
        >
          {TAB_IDS.map((id) => (
            <Tab
              key={id}
              value={id}
              id={`tab-${id}`}
              aria-controls={`panel-${id}`}
              label={<TabLabel id={id} count={counts[id]} />}
              sx={{
                minHeight: 44,
                minWidth: 0,
                px: 1.5,
                fontSize: "0.875rem",
                fontWeight: 500,
                color: tokens.muted,
                opacity: 1,
                "&.Mui-selected": { color: tokens.ink },
                "&:hover": { color: tokens.ink },
              }}
            />
          ))}
        </Tabs>

        <TabPanel id={tab}>
          {tab === "overview" && <OverviewTab {...tabProps} />}
          {tab === "outages" && <OutagesTab {...tabProps} />}
          {tab === "causes" && <CausesTab {...tabProps} />}
          {tab === "sla" && <SlaTab stats={stats} />}
          {tab === "quality" && <DataQualityTab detail={detail} />}
        </TabPanel>
      </Collapse>
    </Box>
  );
}

/** A view name, with a count beside it when there's something in it worth noticing. */
function TabLabel({ id, count }: { id: TabId; count: TabCounts[TabId] }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      {TAB_LABELS[id]}
      {count && count.value > 0 && (
        <Box
          component="span"
          aria-label={`(${count.value})`}
          sx={{
            ...dataType,
            minWidth: 20,
            px: 0.75,
            borderRadius: 999,
            fontSize: "0.6875rem",
            fontWeight: 600,
            lineHeight: "18px",
            textAlign: "center",
            bgcolor: count.alert ? tokens.outageWash : "#F3F4F6",
            color: count.alert ? tokens.outage : tokens.inkSecondary,
            border: `1px solid ${count.alert ? tokens.outageBorder : tokens.grid}`,
          }}
        >
          {count.value}
        </Box>
      )}
    </Box>
  );
}
