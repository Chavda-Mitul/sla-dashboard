import { createTheme } from "@mui/material/styles";

/**
 * Quiet when healthy, loud when broken: only failures get color.
 * outage/transient were run through the dataviz palette validator against the white chart
 * surface (CVD and normal-vision separation pass, both >= 3:1 contrast).
 */
export const tokens = {
  paper: "#F6F8F9", // page
  surface: "#FFFFFF", // tables, chart
  ink: "#17232D",
  inkSecondary: "#4A5964",
  muted: "#5F6E79",
  grid: "#D6DDE2",
  hairline: "#E4E9EC",
  petrol: "#0E6070", // interactive
  outage: "#C0392B",
  outageWash: "#FBEDEB",
  transient: "#B87F0F",
  met: "#2E7550",
} as const;

export const fonts = {
  ui: '"Barlow", system-ui, sans-serif',
  data: '"Barlow Semi Condensed", "Barlow", system-ui, sans-serif',
} as const;

export const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: tokens.paper, paper: tokens.surface },
    text: { primary: tokens.ink, secondary: tokens.inkSecondary },
    primary: { main: tokens.petrol },
    error: { main: tokens.outage },
    warning: { main: tokens.transient },
    success: { main: tokens.met },
    divider: tokens.hairline,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: fonts.ui,
    fontSize: 15,
    // Scale: 13 / 15 / 18 / 32. The verdict headline is the only large type on the page.
    h1: { fontSize: "2rem", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em" },
    h2: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.35 },
    h3: { fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.45 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontFamily: fonts.data,
          fontSize: "0.875rem",
          fontVariantNumeric: "tabular-nums",
          borderColor: tokens.hairline,
          padding: "6px 12px",
        },
        head: { fontWeight: 600, color: tokens.inkSecondary, whiteSpace: "nowrap" },
      },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: true },
      styleOverrides: { root: { background: "transparent", "&::before": { display: "none" } } },
    },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", padding: "5px 12px" } } },
  },
});
