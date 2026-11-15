import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import { useEffect, useState } from "react";
import { DashboardView } from "./dashboard/DashboardView";
import { ALL_DATES, type DateFilter } from "./dashboard/dateFilter";
import { tokens } from "./theme";
import { UploadView } from "./upload/UploadView";

type View = "dashboard" | "upload";

interface AppState {
  view: View;
  datasetId: string | null;
  filter: DateFilter;
}

/** The view, dataset and date filter live in the URL, so a link reopens the same view. */
function readUrl(): AppState {
  const params = new URLSearchParams(window.location.search);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const mode = !from && !to ? "all" : from === to ? "day" : "range";
  return {
    view: params.get("view") === "upload" ? "upload" : "dashboard",
    datasetId: params.get("dataset"),
    filter: { mode, from, to },
  };
}

function writeUrl({ view, datasetId, filter }: AppState): void {
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
  const search = params.toString();
  window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
}

export default function App() {
  const [state, setState] = useState<AppState>(readUrl);
  useEffect(() => writeUrl(state), [state]);

  const showView = (view: View) => setState((s) => ({ ...s, view }));

  return (
    <>
      <Box component="header" sx={{ bgcolor: tokens.surface, borderBottom: `1px solid ${tokens.hairline}` }}>
        <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 3 }, minHeight: 56 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 600, fontSize: "1.0625rem" }}>
            <img src="/favicon.svg" alt="" width={22} height={22} />
            SLA monitor
          </Box>
          <Box component="nav" aria-label="Main" sx={{ display: "flex", gap: 0.5 }}>
            {(["dashboard", "upload"] as const).map((view) => (
              <Button
                key={view}
                onClick={() => showView(view)}
                aria-current={state.view === view ? "page" : undefined}
                color="inherit"
                sx={{
                  color: state.view === view ? tokens.ink : tokens.muted,
                  borderBottom: `2px solid ${state.view === view ? tokens.petrol : "transparent"}`,
                  borderRadius: 0,
                }}
              >
                {view === "dashboard" ? "Dashboard" : "Upload CSV"}
              </Button>
            ))}
          </Box>
        </Container>
      </Box>

      <Container component="main" maxWidth="lg" sx={{ py: 3 }}>
        {state.view === "upload" ? (
          <UploadView
            onOpenDataset={(datasetId) =>
              setState({ view: "dashboard", datasetId, filter: ALL_DATES })
            }
          />
        ) : (
          <DashboardView
            datasetId={state.datasetId}
            filter={state.filter}
            onDatasetChange={(datasetId) =>
              setState((s) => ({ ...s, datasetId, filter: ALL_DATES }))
            }
            onFilterChange={(filter) => setState((s) => ({ ...s, filter }))}
            onUploadClick={() => showView("upload")}
          />
        )}
      </Container>
    </>
  );
}
