import { createTheme } from "@mui/material/styles";

/**
 * Clean light product UI: white surfaces, soft gray borders, indigo for anything clickable.
 * Rose, amber and green only ever mean outage, transient error and met. outage/transient were
 * run through the dataviz palette validator on white (CVD 9.4, normal-vision 16.6, both >= 3:1).
 */
export const tokens = {
  paper: "#FFFFFF", // page
  surface: "#FFFFFF", // panels, tables, charts
  subtle: "#F9FAFB", // table heads, hover rows
  ink: "#111827",
  inkSecondary: "#4B5563",
  muted: "#6B7280",
  grid: "#E5E7EB", // borders
  hairline: "#F0F1F4", // dividers inside panels
  accent: "#4F46E5", // interactive (indigo)
  accentWash: "#EEF2FF",
  outage: "#E11D48",
  outageWash: "#FFF1F2",
  outageBorder: "#FECDD3",
  transient: "#D97706",
  transientWash: "#FFFBEB",
  met: "#16A34A",
  metWash: "#F0FDF4",
  metBorder: "#BBF7D0",
} as const;

export const fonts = {
  ui: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  data: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

/** Spread into a style object for numbers that line up in columns and on chart axes. */
export const dataType = { fontFamily: fonts.data, fontVariantNumeric: "tabular-nums" } as const;

export const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: tokens.paper, paper: tokens.surface },
    text: { primary: tokens.ink, secondary: tokens.inkSecondary },
    primary: { main: tokens.accent },
    error: { main: tokens.outage },
    warning: { main: tokens.transient },
    success: { main: tokens.met },
    divider: tokens.grid,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: fonts.ui,
    fontSize: 14,
    // Scale: 12 / 13 / 14 / 16 / 24.
    h1: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.02em" },
    h2: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.01em" },
    h3: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: "0.875rem", lineHeight: 1.55 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.5 },
    button: { textTransform: "none", fontWeight: 500, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { WebkitFontSmoothing: "antialiased" } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          ...dataType,
          fontSize: "0.8125rem",
          borderColor: tokens.hairline,
          padding: "9px 14px",
          // Narrow screens scroll the table sideways instead of squeezing "svc-search" onto two lines.
          whiteSpace: "nowrap",
        },
        head: {
          fontWeight: 500,
          fontSize: "0.75rem",
          color: tokens.muted,
          whiteSpace: "nowrap",
          backgroundColor: tokens.subtle,
          borderColor: tokens.grid,
        },
      },
    },
    MuiTableRow: { styleOverrides: { root: { "&:last-child td": { borderBottom: 0 } } } },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: true },
      styleOverrides: { root: { background: "transparent", "&::before": { display: "none" } } },
    },
    MuiToggleButton: {
      styleOverrides: { root: { textTransform: "none", padding: "5px 12px", fontWeight: 500, color: tokens.inkSecondary } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.grid },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#D1D5DB" },
        },
      },
    },
    MuiSwitch: { defaultProps: { size: "small" } },
  },
});
