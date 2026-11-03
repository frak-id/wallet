import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { merchant } from "@/data/merchant";
import { deviceInset, fonts } from "@/shell/device.css";

const ig = {
    text: "#000",
    secondary: "#737373",
    separator: "#dbdbdb",
    blue: "#0095f6",
    red: "#ff3040",
};

export const root = style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    color: ig.text,
    fontFamily: fonts.system,
    WebkitFontSmoothing: "antialiased",
});

export const header = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: `calc(${deviceInset.top} + 48px)`,
    paddingTop: deviceInset.top,
    paddingInline: "16px 14px",
    background: "#fff",
});

export const wordmark = style({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontFamily:
        '"Snell Roundhand", "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive',
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    lineHeight: 1,
    paddingTop: 4,
});

export const headerIcons = style({
    display: "flex",
    alignItems: "center",
    gap: 20,
});

export const badgeHost = style({
    position: "relative",
    display: "grid",
});

export const dot = style({
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: ig.red,
    border: "1.5px solid #fff",
});

export const countBadge = style({
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    display: "grid",
    placeItems: "center",
    borderRadius: 9,
    background: ig.red,
    border: "1.5px solid #fff",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
});

export const scroll = style({
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
});

export const tray = style({
    display: "flex",
    gap: 10,
    padding: "6px 12px 10px",
    overflowX: "auto",
    scrollbarWidth: "none",
    borderBottom: `0.5px solid ${ig.separator}`,
    selectors: {
        "&::-webkit-scrollbar": { display: "none" },
    },
});

export const trayItem = style({
    flexShrink: 0,
    width: 82,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    color: "inherit",
    WebkitTapHighlightColor: "transparent",
});

export const trayItemActive = style({
    cursor: "pointer",
    transition: "transform 140ms ease",
    selectors: {
        "&:active": { transform: "scale(0.94)" },
    },
});

export const trayAvatar = style({
    position: "relative",
    display: "block",
    width: 80,
    height: 80,
});

const trayPulse = keyframes({
    "0%, 55%, 100%": { transform: "scale(1)" },
    "20%": { transform: "scale(1.07)" },
    "38%": { transform: "scale(0.98)" },
});

export const trayHint = style({
    animation: `${trayPulse} 1.8s ease-in-out infinite`,
});

export const addBadge = style({
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 26,
    height: 26,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#000",
    color: "#fff",
    border: "3px solid #fff",
});

export const trayLabel = recipe({
    base: {
        maxWidth: "100%",
        fontSize: 12,
        lineHeight: 1.25,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    variants: {
        muted: {
            true: { color: ig.secondary },
            false: { color: ig.text },
        },
    },
});

export const post = style({
    paddingBottom: 14,
});

export const postHeader = style({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px 10px 12px",
});

export const postAuthor = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.25,
});

export const handle = style({
    fontSize: 14,
    fontWeight: 600,
});

export const postSubtitle = style({
    fontSize: 12,
});

export const postMedia = recipe({
    base: {
        position: "relative",
        width: "100%",
        overflow: "hidden",
        background: "#efefef",
    },
    variants: {
        aspect: {
            square: { aspectRatio: "1 / 1" },
            portrait: { aspectRatio: "4 / 5" },
        },
    },
});

export const postActions = style({
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "10px 14px 6px",
});

export const spacer = style({
    flex: 1,
});

export const postBody = style({
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingInline: 14,
    fontSize: 14,
    lineHeight: 1.35,
});

export const postLine = style({
    margin: 0,
});

export const postMuted = style({
    margin: 0,
    color: ig.secondary,
});

export const postAge = style({
    margin: 0,
    fontSize: 12,
    color: ig.secondary,
});

export const brandAvatar = style({
    display: "block",
    width: "100%",
    height: "100%",
    padding: 4,
    borderRadius: "50%",
    background: merchant.palette.paper,
    boxShadow: `inset 0 0 0 0.5px ${ig.separator}`,
});

export const tabBar = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    height: `calc(${deviceInset.bottom} + 50px)`,
    paddingBottom: deviceInset.bottom,
    borderTop: `0.5px solid ${ig.separator}`,
    background: "#fff",
});
