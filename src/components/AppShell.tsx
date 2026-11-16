import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import ListAltOutlined from "@mui/icons-material/ListAltOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import ReportGmailerrorredOutlined from "@mui/icons-material/ReportGmailerrorredOutlined";
import SpaceDashboardOutlined from "@mui/icons-material/SpaceDashboardOutlined";
import TroubleshootOutlined from "@mui/icons-material/TroubleshootOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import { useEffect, useRef, type ReactNode } from "react";
import type { NavCounts, TabId } from "../dashboard/tabs";
import { TAB_IDS, TAB_LABELS } from "../dashboard/tabs";
import { dataType, tokens } from "../theme";

const ICONS: Record<TabId | "upload", typeof FactCheckOutlined> = {
  overview: SpaceDashboardOutlined,
  outages: ReportGmailerrorredOutlined,
  causes: TroubleshootOutlined,
  sla: ReceiptLongOutlined,
  logs: ListAltOutlined,
  quality: FactCheckOutlined,
  upload: UploadFileOutlined,
};

export type NavTarget = TabId | "upload";

interface Props {
  active: NavTarget;
  counts: NavCounts;
  onNavigate: (target: NavTarget) => void;
  children: ReactNode;
}

/**
 * The console frame. Wide screens: a navy rail on the left lists every section, with counts so
 * trouble shows before a section is opened. Narrow screens: the same items as a scrolling row.
 */
export function AppShell({ active, counts, onNavigate, children }: Props) {
  const items: NavTarget[] = [...TAB_IDS, "upload"];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", flexDirection: { xs: "column", md: "row" } }}>
      <Box
        component="aside"
        sx={{
          bgcolor: tokens.rail,
          color: tokens.railInk,
          flexShrink: 0,
          width: { md: 232 },
          position: { xs: "sticky", md: "sticky" },
          top: 0,
          zIndex: 4,
          height: { md: "100vh" },
          display: "flex",
          flexDirection: { xs: "column", md: "column" },
        }}
      >
        <Brand />
        <Box
          component="nav"
          aria-label="Sections"
          sx={{
            display: "flex",
            flexDirection: { xs: "row", md: "column" },
            gap: { xs: 0.5, md: 0.25 },
            px: { xs: 1, md: 1.5 },
            pb: { xs: 1, md: 2 },
            overflowX: { xs: "auto", md: "visible" },
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            flex: { md: 1 },
          }}
        >
          {items.map((target) => (
            <NavItem
              key={target}
              target={target}
              active={active === target}
              count={target === "upload" ? undefined : counts[target]}
              onClick={() => onNavigate(target)}
              separated={target === "upload"}
            />
          ))}
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3, lg: 5 }, pb: 6 }}>
        <Box sx={{ maxWidth: 1240, mx: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}

function Brand() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: { xs: 2, md: 2.5 }, pt: { xs: 1.5, md: 3 }, pb: { xs: 1, md: 3 } }}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="6" fill={tokens.accent} />
        <path d="M4 15h5l2.5-6 3.5 10 2.5-6H22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Box>
        <Box sx={{ fontWeight: 700, fontSize: "1.0625rem", fontStretch: "112.5%", lineHeight: 1.1 }}>SLA monitor</Box>
        <Box sx={{ fontSize: "0.75rem", color: tokens.railMuted, display: { xs: "none", md: "block" } }}>Uptime, outages and credits</Box>
      </Box>
    </Box>
  );
}

function NavItem({
  target,
  active,
  count,
  separated,
  onClick,
}: {
  target: NavTarget;
  active: boolean;
  count: NavCounts[TabId];
  separated: boolean;
  onClick: () => void;
}) {
  const Icon = ICONS[target];
  const ref = useRef<HTMLButtonElement>(null);
  // On narrow screens the items scroll sideways; keep the open section visible.
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
        justifyContent: "flex-start",
        gap: 1.25,
        px: 1.25,
        py: { xs: 0.75, md: 1 },
        mt: { md: separated ? "auto" : 0 },
        borderRadius: 1.5,
        fontSize: "0.9375rem",
        fontWeight: active ? 650 : 500,
        color: active ? "#fff" : tokens.railInk,
        bgcolor: active ? tokens.railRaised : "transparent",
        boxShadow: active ? `inset 3px 0 0 ${tokens.accent}` : "none",
        whiteSpace: "nowrap",
        "&:hover": { bgcolor: active ? tokens.railRaised : "rgba(255,255,255,0.06)" },
        "&.Mui-focusVisible": { outline: `2px solid ${tokens.railInk}`, outlineOffset: -2 },
      }}
    >
      <Icon sx={{ fontSize: 19, color: active ? "#fff" : tokens.railMuted }} />
      <Box component="span" sx={{ flex: 1, textAlign: "left" }}>
        {target === "upload" ? "Upload CSV" : TAB_LABELS[target]}
      </Box>
      {count && count.value > 0 && (
        <Box
          component="span"
          aria-label={`(${count.value})`}
          sx={{
            ...dataType,
            minWidth: 22,
            px: 0.75,
            borderRadius: 999,
            fontSize: "0.75rem",
            fontWeight: 650,
            lineHeight: "20px",
            textAlign: "center",
            bgcolor: count.alert ? tokens.outage : "rgba(255,255,255,0.12)",
            color: "#fff",
          }}
        >
          {count.value}
        </Box>
      )}
    </ButtonBase>
  );
}
