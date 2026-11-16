import { createTheme } from "@mui/material/styles";

/**
 * An operations console: a navy rail holds the sections, the work area is a cool blue-gray page
 * with white instrument panels. Cobalt marks what can be clicked; red, amber and green only ever
 * mean outage, transient error and met. outage/transient were run through the dataviz palette
 * validator against the white chart surface (CVD and normal-vision separation pass, >= 3:1).
 */
export const tokens = {
  paper: "#EDF1F5", // page
  surface: "#FFFFFF", // panels, tables, charts
  ink: "#16233A",
  inkSecondary: "#46546B",
  muted: "#5F6C82",
  grid: "#D3DAE3",
  hairline: "#E1E6ED",
  accent: "#2457D6", // interactive
  accentWash: "#E6EDFC",
  rail: "#1B2A41", // side navigation
  railRaised: "#24375A",
  railInk: "#E4EAF4",
  railMuted: "#9AA8C0",
  outage: "#C0392B",
  outageWash: "#FBEDEB",
  transient: "#B87F0F",
  transientWash: "#FBF3E2",
  met: "#2E7550",
  metWash: "#E8F3EC",
} as const;

/** One family, Archivo, with width as the voice: wide for titles, narrow for numbers. */
export const fonts = {
  ui: '"Archivo", system-ui, sans-serif',
  data: '"Archivo", system-ui, sans-serif',
} as const;

/** Spread into a style object for numbers and chart text: narrow width, even-width digits. */
export const dataType = { fontFamily: fonts.data, fontStretch: "87.5%", fontVariantNumeric: "tabular-nums" } as const;

export const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: tokens.paper, paper: tokens.surface },
    text: { primary: tokens.ink, secondary: tokens.inkSecondary },
    primary: { main: tokens.accent },
    error: { main: tokens.outage },
    warning: { main: tokens.transient },
    success: { main: tokens.met },
    divider: tokens.hairline,
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: fonts.ui,
    fontSize: 15,
    // Scale: 13 / 15 / 18 / 22 / 30. Titles run wide (fontStretch 112.5%), body at normal width.
    h1: { fontSize: "1.875rem", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.015em", fontStretch: "112.5%" },
    h2: { fontSize: "1.125rem", fontWeight: 650, lineHeight: 1.3, fontStretch: "106%" },
    h3: { fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.45 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { fontStretch: "100%" } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: {
      styleOverrides: {
        root: {
          ...dataType,
          fontSize: "0.875rem",
          borderColor: tokens.hairline,
          padding: "7px 12px",
          // Narrow screens scroll the table sideways instead of squeezing "svc-search" onto two lines.
          whiteSpace: "nowrap",
        },
        head: { fontWeight: 600, color: tokens.inkSecondary, whiteSpace: "nowrap", backgroundColor: "#F6F8FB" },
      },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: true },
      styleOverrides: { root: { background: "transparent", "&::before": { display: "none" } } },
    },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", padding: "5px 12px" } } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: tokens.surface } } },
  },
});
