import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { fonts, iosColors } from "@/shell/device.css";

const iosBlue = iosColors.blue;
const secondaryLabel = iosColors.secondaryLabel;
const separator = iosColors.separator;

export const scroller = style({
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "14px 20px 28px",
});

export const topBar = style({
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 6,
});

export const closeButton = style({
    width: 30,
    height: 30,
    display: "grid",
    placeItems: "center",
    border: 0,
    borderRadius: "50%",
    background: "rgba(120, 120, 128, 0.14)",
    color: "#3c3c43",
});

export const appHeader = style({
    display: "flex",
    gap: 16,
});

export const appIcon = style({
    flexShrink: 0,
    width: 118,
    height: 118,
    borderRadius: 27,
    overflow: "hidden",
    boxShadow: "0 0 0 0.5px rgba(0, 0, 0, 0.12)",
});

export const appInfo = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    paddingTop: 2,
});

export const appName = style({
    margin: 0,
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: "-0.01em",
});

export const appSubtitle = style({
    marginTop: 2,
    fontSize: 15,
    color: secondaryLabel,
});

export const actions = style({
    marginTop: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
});

export const pillButton = style({
    minWidth: 82,
    height: 30,
    padding: "0 16px",
    display: "grid",
    placeItems: "center",
    border: 0,
    borderRadius: 15,
    background: iosBlue,
    color: "#fff",
    fontFamily: fonts.system,
    fontSize: 15,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.01em",
    cursor: "pointer",
    transition: "transform 120ms ease, opacity 120ms ease",
    selectors: {
        "&:active": { transform: "scale(0.94)", opacity: 0.8 },
    },
});

export const progressButton = style({
    width: 82,
    height: 30,
    display: "grid",
    placeItems: "center",
    border: 0,
    padding: 0,
    background: "transparent",
    color: iosBlue,
});

export const shareIcon = style({
    color: iosBlue,
});

export const infoStrip = style({
    display: "flex",
    marginTop: 22,
    paddingBlock: 12,
    borderTop: `0.5px solid ${separator}`,
    borderBottom: `0.5px solid ${separator}`,
});

export const infoItem = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    textAlign: "center",
    selectors: {
        "& + &": { borderLeft: `0.5px solid ${separator}` },
    },
});

export const infoLabel = style({
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    color: "rgba(60, 60, 67, 0.45)",
});

export const infoValue = style({
    fontSize: 20,
    lineHeight: 1.1,
    fontWeight: 700,
    color: "rgba(60, 60, 67, 0.62)",
});

export const infoSub = style({
    fontSize: 12,
    color: "rgba(60, 60, 67, 0.45)",
    whiteSpace: "nowrap",
});

export const stars = style({
    fontSize: 11,
    letterSpacing: 1,
    color: "rgba(60, 60, 67, 0.62)",
});

export const shots = style({
    display: "flex",
    gap: 10,
    marginTop: 20,
    marginInline: -20,
    paddingInline: 20,
    overflow: "hidden",
});

export const shot = style({
    flexShrink: 0,
    width: 172,
    height: 340,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: "18px 14px 0",
    borderRadius: 20,
    overflow: "hidden",
    background: `linear-gradient(180deg, ${brand.colors.primary[100]} 0%, ${brand.colors.primary[50]} 100%)`,
    boxShadow: "0 0 0 0.5px rgba(0, 0, 0, 0.08)",
});

export const shotCaption = style({
    fontFamily: fonts.inter,
    fontSize: 15,
    lineHeight: 1.2,
    fontWeight: 700,
    color: "#00288f",
    textAlign: "center",
});

export const shotScreen = style({
    flex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "14px 8px 0",
    borderRadius: "22px 22px 0 0",
    background: "#fff",
    boxShadow: "0 0 0 5px #1c1c1e",
    marginInline: 6,
    overflow: "hidden",
});

export const shotImage = style({
    display: "block",
    width: "100%",
    height: "auto",
    objectFit: "contain",
});

export const description = style({
    marginTop: 20,
    fontSize: 15,
    lineHeight: 1.4,
    color: "#000",
});
