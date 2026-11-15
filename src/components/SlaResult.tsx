import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import Box from "@mui/material/Box";
import { tokens } from "../theme";

/** Status always pairs an icon with words; the color is never the only signal. */
export function SlaResult({ met }: { met: boolean }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, whiteSpace: "nowrap" }}>
      {met ? (
        <CheckCircleOutlineIcon sx={{ fontSize: 18, color: tokens.met }} />
      ) : (
        <ErrorOutlineIcon sx={{ fontSize: 18, color: tokens.outage }} />
      )}
      {met ? "Met" : "Breached, credit due"}
    </Box>
  );
}
