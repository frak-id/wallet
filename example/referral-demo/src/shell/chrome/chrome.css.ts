import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { deviceInset, fonts, iosColors } from "../device.css";

export const bare = recipe({
    base: {
        position: "absolute",
        inset: 0,
        overflow: "hidden",
    },
    variants: {
        app: {
            instagram: { background: "#fff" },
            wallet: { background: "#fff" },
            bank: { background: "#fff" },
            lock: { background: "#000" },
            stage: { background: "#060b1f" },
        },
    },
});

/** Browser window: top strip, page viewport, toolbar. */
export const browser = style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    fontFamily: fonts.system,
});

/** The page itself: screens fill it and scroll inside it. */
/** A browser's page area: the toolbars already absorb the device insets. */
export const viewport = style({
    position: "relative",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    background: "#fff",
    vars: {
        [deviceInset.top]: "0px",
        [deviceInset.bottom]: "0px",
    },
});

export const safariTop = style({
    height: deviceInset.top,
    flexShrink: 0,
    background: "#fff",
});

export const safariToolbar = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 14px",
    paddingBottom: `calc(${deviceInset.bottom} + 6px)`,
    background: "rgba(249, 249, 249, 0.94)",
    borderTop: "0.5px solid rgba(0, 0, 0, 0.12)",
    backdropFilter: "saturate(180%) blur(20px)",
});

export const roundButton = style({
    flexShrink: 0,
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    color: "#1c1c1e",
    background: "rgba(255, 255, 255, 0.9)",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.06)",
});

export const urlPill = style({
    position: "relative",
    flex: 1,
    minWidth: 0,
    height: 44,
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingInline: 14,
    borderRadius: 22,
    overflow: "hidden",
    background: "rgba(255, 255, 255, 0.95)",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.06)",
    color: "#1c1c1e",
});

export const urlText = style({
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    fontSize: 15,
    fontWeight: 500,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const urlMuted = style({ color: "#8e8e93" });

export const progress = style({
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 2.5,
    background: iosColors.blue,
    borderRadius: 2,
});

export const inAppHeader = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px 8px",
    paddingTop: `calc(${deviceInset.top} + 2px)`,
    background: "#fff",
    borderBottom: "0.5px solid #dbdbdb",
    color: "#000",
});

export const inAppTitle = style({
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    lineHeight: 1.2,
});

export const inAppName = style({
    display: "block",
    fontSize: 15,
    fontWeight: 600,
});

export const inAppDomain = style({
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: 12,
    color: "#737373",
});

export const iconButton = style({
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    color: "#000",
});

export const inAppBottom = style({
    flexShrink: 0,
    height: deviceInset.bottom,
    background: "#fff",
});
