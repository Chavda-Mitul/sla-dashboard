import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode, RefObject } from "react";
import { tokens } from "../../theme";
import { FRAME_PAD, type Tip } from "./chartUtils";

/** Dark tooltip above a point given in chart (svg) coordinates. */
export function ChartTooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <Box
      role="tooltip"
      sx={{
        position: "absolute",
        left: tip.x + FRAME_PAD,
        top: tip.y + FRAME_PAD,
        transform: "translate(-50%, calc(-100% - 6px))",
        pointerEvents: "none",
        bgcolor: tokens.ink,
        color: "#fff",
        px: 1.25,
        py: 0.75,
        borderRadius: 1,
        fontSize: "0.8125rem",
        lineHeight: 1.4,
        display: "flex",
        flexDirection: "column",
        whiteSpace: "nowrap",
        zIndex: 2,
        "& span": { color: "#C9D3DA" },
      }}
    >
      {tip.content}
    </Box>
  );
}

export function ChartFrame({ children, frameRef }: { children: ReactNode; frameRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <Box
      ref={frameRef}
      sx={{ position: "relative", bgcolor: tokens.surface, border: `1px solid ${tokens.hairline}`, borderRadius: 1, p: `${FRAME_PAD}px` }}
    >
      {children}
    </Box>
  );
}

export function LegendKey({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <svg width="16" height="14" aria-hidden="true">
        {swatch}
      </svg>
      <Typography variant="body2" component="span">
        {children}
      </Typography>
    </Box>
  );
}

export function Legend({ children }: { children: ReactNode }) {
  return <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 3, rowGap: 0.5, mb: 1, color: tokens.inkSecondary }}>{children}</Box>;
}

