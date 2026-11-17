/** The views inside the stats section, in display order. The open one is kept in the URL (?tab=). */
export const TAB_IDS = ["overview", "outages", "causes", "sla", "quality"] as const;
export type TabId = (typeof TAB_IDS)[number];

export const isTabId = (value: string | null): value is TabId => TAB_IDS.includes(value as TabId);

export const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  outages: "Outages",
  causes: "Errors & latency",
  sla: "SLA & billing",
  quality: "Data quality",
};

/** Numbers shown beside view names; `alert` marks one that needs attention. */
export type TabCounts = Partial<Record<TabId, { value: number; alert: boolean }>>;
