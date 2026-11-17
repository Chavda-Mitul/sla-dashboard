import { useEffect, useState } from "react";
import { AppShell, type View } from "./components/AppShell";
import { DashboardView } from "./dashboard/DashboardView";
import { ALL_DATES, type DateFilter } from "./dashboard/dateFilter";
import { isTabId, type TabId } from "./dashboard/tabs";
import { UploadView } from "./upload/UploadView";

interface AppState {
  view: View;
  datasetId: string | null;
  filter: DateFilter;
  tab: TabId;
}

/** The screen, stats view, dataset and date filter live in the URL, so a link reopens the same view. */
function readUrl(): AppState {
  const params = new URLSearchParams(window.location.search);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const mode = !from && !to ? "all" : from === to ? "day" : "range";
  const tab = params.get("tab");
  return {
    view: params.get("view") === "upload" ? "upload" : "dashboard",
    datasetId: params.get("dataset"),
    filter: { mode, from, to },
    tab: isTabId(tab) ? tab : "overview",
  };
}

function writeUrl({ view, datasetId, filter, tab }: AppState): void {
  const params = new URLSearchParams();
  if (view === "upload") params.set("view", "upload");
  if (datasetId) params.set("dataset", datasetId);
  if (filter.mode === "day" && filter.from) {
    params.set("from", filter.from);
    params.set("to", filter.from);
  } else if (filter.mode === "range") {
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
  }
  if (view === "dashboard" && tab !== "overview") params.set("tab", tab);
  const search = params.toString();
  window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
}

export default function App() {
  const [state, setState] = useState<AppState>(readUrl);
  useEffect(() => writeUrl(state), [state]);

  function navigate(view: View) {
    setState((s) => ({ ...s, view }));
    window.scrollTo({ top: 0 });
  }

  return (
    <AppShell active={state.view} onNavigate={navigate}>
      {state.view === "upload" ? (
        <UploadView onOpenDataset={(datasetId) => setState({ view: "dashboard", datasetId, filter: ALL_DATES, tab: "overview" })} />
      ) : (
        <DashboardView
          datasetId={state.datasetId}
          filter={state.filter}
          tab={state.tab}
          onTabChange={(tab) => setState((s) => ({ ...s, tab }))}
          onDatasetChange={(datasetId) => setState((s) => ({ ...s, datasetId, filter: ALL_DATES }))}
          onFilterChange={(filter) => setState((s) => ({ ...s, filter }))}
          onUploadClick={() => navigate("upload")}
        />
      )}
    </AppShell>
  );
}
