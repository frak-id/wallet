import { style } from "@vanilla-extract/css";

// Raw px/rgba on purpose — this replicates an iOS lock-screen notification
// (white glass over a photo), not our themed surfaces.

export const phone = style({
    position: "relative",
    width: "353px",
    maxWidth: "100%",
});

export const phoneImage = style({
    display: "block",
    width: "100%",
    height: "auto",
});

/** Glass notification, centered horizontally and ~34% down the wallpaper. */
export const notification = style({
    position: "absolute",
    top: "34%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "85.9%",
    display: "flex",
    alignItems: "flex-start",
    gap: "9.83px",
    padding: "9.83px",
    borderRadius: "16.39px",
    // The frosted glass (blur + tint + border) is baked into the exported
    // image — set via inline `backgroundImage` in the component.
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
    color: "#ffffff",
    fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
});

export const icon = style({
    flexShrink: 0,
    width: "31px",
    height: "31px",
    borderRadius: "6.33px",
    overflow: "hidden",
});

export const iconImage = style({
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

export const body = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "flex-start",
    gap: "13.11px",
});

export const text = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.82px",
});

export const title = style({
    margin: 0,
    fontSize: "12.29px",
    lineHeight: "15px",
    fontWeight: 590,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const message = style({
    margin: 0,
    fontSize: "11.47px",
    lineHeight: "14px",
    fontWeight: 400,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
});

export const time = style({
    flexShrink: 0,
    fontSize: "9.83px",
    lineHeight: "11px",
    letterSpacing: "-0.02em",
    opacity: 0.5,
    whiteSpace: "nowrap",
});
