import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { deviceInset, fonts } from "../device.css";

export const banner = style({
    position: "absolute",
    zIndex: 45,
    top: `calc(${deviceInset.top} + 4px)`,
    left: 8,
    right: 8,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 26,
    background: "rgba(246, 246, 246, 0.82)",
    backdropFilter: "saturate(180%) blur(24px)",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
    color: "#000",
    fontFamily: fonts.system,
});

export const icon = style({
    flexShrink: 0,
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    background: "#fff",
    color: brand.colors.primary[600],
    boxShadow: "0 0 0 0.5px rgba(0, 0, 0, 0.08)",
});

export const text = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
});

export const header = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
});

export const title = style({
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
});

export const time = style({
    flexShrink: 0,
    fontSize: 13,
    color: "rgba(60, 60, 67, 0.6)",
});

export const body = style({
    fontSize: 15,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
});
