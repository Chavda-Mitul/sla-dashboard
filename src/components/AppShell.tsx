import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import type { ReactNode } from "react";
import { tokens } from "../theme";

export type View = "dashboard" | "upload";

interface Props {
  active: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

const WIDTH = 1200;

/** App frame: a white top bar with the brand and the two screens, the dashboard and the upload. */
export function AppShell({ active, onNavigate, children }: Props) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: tokens.paper }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "rgba(255,255,255,0.92)",
          backdropFilter: "saturate(180%) blur(8px)",
          borderBottom: `1px solid ${tokens.grid}`,
        }}
      >
        <Box
          component="nav"
          aria-label="Main"
          sx={{
            maxWidth: WIDTH,
            mx: "auto",
            px: { xs: 2, sm: 3 },
            display: "flex",
            alignItems: "center",
            gap: 1,
            height: 56,
            // Phone widths: keep every label on one line; the upload icon goes first.
            "& .MuiButtonBase-root": { whiteSpace: "nowrap", flexShrink: 0 },
            "& .MuiButton-startIcon": { display: { xs: "none", sm: "inherit" } },
          }}
        >
          <Brand onClick={() => onNavigate("dashboard")} />
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            onClick={() => onNavigate("dashboard")}
            aria-current={active === "dashboard" ? "page" : undefined}
            sx={{
              color: active === "dashboard" ? tokens.ink : tokens.muted,
              fontWeight: active === "dashboard" ? 600 : 500,
              "&:hover": { bgcolor: tokens.subtle, color: tokens.ink },
            }}
          >
            Dashboard
          </Button>
          <Button
            variant={active === "upload" ? "contained" : "outlined"}
            size="small"
            startIcon={<UploadFileOutlined sx={{ fontSize: 18 }} />}
            onClick={() => onNavigate("upload")}
            aria-current={active === "upload" ? "page" : undefined}
            sx={{
              borderColor: tokens.grid,
              color: active === "upload" ? "#fff" : tokens.ink,
              "&:hover": { borderColor: "#D1D5DB", bgcolor: active === "upload" ? undefined : tokens.subtle },
            }}
          >
            Upload CSV
          </Button>
        </Box>
      </Box>

      <Box component="main" sx={{ maxWidth: WIDTH, mx: "auto", px: { xs: 2, sm: 3 }, pb: 8 }}>
        {children}
      </Box>
    </Box>
  );
}

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} aria-label="SLA monitor, go to the dashboard" sx={{ gap: 1, borderRadius: 1, px: 0.5, ml: -0.5 }}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill={tokens.accent} />
        <path d="M4 13.5h4l2.2-5.5 3.3 9 2.2-5.5H20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Box component="span" sx={{ fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "-0.01em", color: tokens.ink }}>
        SLA monitor
      </Box>
    </ButtonBase>
  );
}
