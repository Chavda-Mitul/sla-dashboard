import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import { useEffect, useRef, type ReactNode } from "react";
import type { NavCounts, TabId } from "../dashboard/tabs";
import { TAB_IDS, TAB_LABELS } from "../dashboard/tabs";
import { dataType, tokens } from "../theme";

export type NavTarget = TabId | "upload";

interface Props {
  active: NavTarget;
  counts: NavCounts;
  onNavigate: (target: NavTarget) => void;
  children: ReactNode;
}

const WIDTH = 1200;

/**
 * App frame: a white top bar with the brand, the section tabs (with counts, so trouble shows
 * before a section is opened) and the upload action. On narrow screens the tabs scroll sideways.
 */
export function AppShell({ active, counts, onNavigate, children }: Props) {
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
        <Box sx={{ maxWidth: WIDTH, mx: "auto", px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, height: 56 }}>
            <Brand onClick={() => onNavigate("overview")} />
            <Box sx={{ flex: 1 }} />
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
          <Box
            component="nav"
            aria-label="Sections"
            sx={{
              display: "flex",
              gap: 0.5,
              mx: -1,
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {TAB_IDS.map((tab) => (
              <NavTab key={tab} tab={tab} active={active === tab} count={counts[tab]} onClick={() => onNavigate(tab)} />
            ))}
          </Box>
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
    <ButtonBase onClick={onClick} aria-label="SLA monitor, go to overview" sx={{ gap: 1, borderRadius: 1, px: 0.5, ml: -0.5 }}>
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

function NavTab({ tab, active, count, onClick }: { tab: TabId; active: boolean; count: NavCounts[TabId]; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  // On narrow screens the tabs scroll sideways; keep the open one visible.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <ButtonBase
      ref={ref}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      sx={{
        flexShrink: 0,
        gap: 0.75,
        px: 1,
        height: 44,
        fontSize: "0.875rem",
        fontWeight: 500,
        color: active ? tokens.ink : tokens.muted,
        whiteSpace: "nowrap",
        position: "relative",
        "&::after": {
          content: '""',
          position: "absolute",
          left: 8,
          right: 8,
          bottom: -1,
          height: 2,
          borderRadius: 2,
          bgcolor: active ? tokens.ink : "transparent",
        },
        "& .label": { px: 0.5, py: 0.5, borderRadius: 1.5 },
        "&:hover .label": { bgcolor: active ? "transparent" : tokens.subtle, color: tokens.ink },
        "&.Mui-focusVisible": { outline: `2px solid ${tokens.accent}`, outlineOffset: -4, borderRadius: 1.5 },
      }}
    >
      <Box component="span" className="label" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
        {TAB_LABELS[tab]}
        {count && count.value > 0 && (
          <Box
            component="span"
            aria-label={`(${count.value})`}
            sx={{
              ...dataType,
              minWidth: 20,
              px: 0.75,
              borderRadius: 999,
              fontSize: "0.6875rem",
              fontWeight: 600,
              lineHeight: "18px",
              textAlign: "center",
              bgcolor: count.alert ? tokens.outageWash : "#F3F4F6",
              color: count.alert ? tokens.outage : tokens.inkSecondary,
              border: `1px solid ${count.alert ? tokens.outageBorder : tokens.grid}`,
            }}
          >
            {count.value}
          </Box>
        )}
      </Box>
    </ButtonBase>
  );
}
