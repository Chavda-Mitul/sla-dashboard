import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { DatasetSummary } from "../../lib/apiTypes";
import { shortDate } from "../format";
import { tokens } from "../theme";
import type { DateFilter } from "./dateFilter";

interface Props {
  datasets: DatasetSummary[];
  datasetId: string;
  onDatasetChange: (id: string) => void;
  filter: DateFilter;
  onFilterChange: (filter: DateFilter) => void;
  minDay: string;
  maxDay: string;
}

/** One row above everything it scopes: stats and logs always show the same slice. */
export function FilterBar({ datasets, datasetId, onDatasetChange, filter, onFilterChange, minDay, maxDay }: Props) {
  const dateInput = { inputLabel: { shrink: true }, htmlInput: { min: minDay, max: maxDay } };

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 2,
        pt: 2.25, // room for the floating input labels
        pb: 1,
      }}
    >
      <TextField
        select
        size="small"
        label="Dataset"
        value={datasetId}
        onChange={(event) => onDatasetChange(event.target.value)}
        sx={{ minWidth: 280, maxWidth: "100%", bgcolor: tokens.surface }}
      >
        {datasets.map((d) => (
          <MenuItem key={d.id} value={d.id}>
            {d.filename}
            <Box component="span" sx={{ color: tokens.muted, ml: 1 }}>
              uploaded {shortDate(d.uploadedAt)}
            </Box>
          </MenuItem>
        ))}
      </TextField>

      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Dates"
        value={filter.mode}
        onChange={(_event, mode: DateFilter["mode"] | null) => {
          if (!mode) return;
          if (mode === "all") onFilterChange({ mode, from: "", to: "" });
          if (mode === "day") onFilterChange({ mode, from: filter.from || minDay, to: filter.from || minDay });
          if (mode === "range") onFilterChange({ mode, from: filter.from || minDay, to: filter.to || maxDay });
        }}
        sx={{ bgcolor: tokens.surface }}
      >
        <ToggleButton value="all">All dates</ToggleButton>
        <ToggleButton value="day">One day</ToggleButton>
        <ToggleButton value="range">Date range</ToggleButton>
      </ToggleButtonGroup>

      {filter.mode === "day" && (
        <TextField
          type="date"
          size="small"
          label="Date (UTC)"
          value={filter.from}
          onChange={(event) => onFilterChange({ mode: "day", from: event.target.value, to: event.target.value })}
          slotProps={dateInput}
          sx={{ bgcolor: tokens.surface }}
        />
      )}

      {filter.mode === "range" && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            type="date"
            size="small"
            label="From (UTC)"
            value={filter.from}
            // Keep the range valid: moving `from` past `to` drags `to` along.
            onChange={(event) => {
              const from = event.target.value;
              onFilterChange({ mode: "range", from, to: filter.to && from > filter.to ? from : filter.to });
            }}
            slotProps={dateInput}
            sx={{ bgcolor: tokens.surface }}
          />
          <TextField
            type="date"
            size="small"
            label="To (UTC)"
            value={filter.to}
            onChange={(event) => {
              const to = event.target.value;
              onFilterChange({ mode: "range", from: filter.from && to && to < filter.from ? to : filter.from, to });
            }}
            slotProps={dateInput}
            sx={{ bgcolor: tokens.surface }}
          />
        </Box>
      )}
    </Box>
  );
}
