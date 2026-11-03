import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, glass } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { deviceInset } from "@/shell/device.css";

const pillRadius = "999px";
const pillHeight = "56px";
const barPaddingBlock = alias.spacing.s;

/** Painted height of the bar above the home indicator inset. */
export const bottomBarHeight = `calc(${pillHeight} + ${barPaddingBlock} * 2)`;

export const wrapper = style({
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    padding: `${barPaddingBlock} ${alias.spacing.m}`,
    paddingBottom: `calc(${barPaddingBlock} + ${deviceInset.bottom})`,
});

export const progressiveBlur = style({
    position: "absolute",
    inset: 0,
    background: glass.blurBase,
    backdropFilter: "blur(14px) saturate(130%)",
    maskImage:
        "linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.45) 55%, transparent 100%)",
    pointerEvents: "none",
});

export const pill = style({
    position: "relative",
    display: "flex",
    alignItems: "stretch",
    width: "100%",
    minHeight: pillHeight,
    maxWidth: "287px",
    borderRadius: pillRadius,
    overflow: "hidden",
    backdropFilter: "blur(5px) saturate(180%)",
    background: glass.fill,
    border: `1px solid ${glass.border}`,
    boxShadow: glass.innerShadow,
});

export const tab = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
    flex: "1 1 0",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    padding: "8px 4px",
    color: vars.text.secondary,
    lineHeight: "12px",
    whiteSpace: "nowrap",
    selectors: {
        '&[aria-current="page"]': { color: vars.text.action },
    },
});

export const tabIcon = style({
    display: "flex",
    color: vars.icon.primary,
    selectors: {
        [`${tab}[aria-current="page"] &`]: { color: vars.icon.action },
    },
});

export const tabLabel = style({
    fontSize: "10px",
    fontWeight: brand.typography.fontWeight.semiBold,
    letterSpacing: "-0.01em",
});

export const glider = style({
    position: "absolute",
    top: "2px",
    bottom: "2px",
    left: 0,
    width: "calc(100% / 3)",
    borderRadius: pillRadius,
    background: glass.indicator,
    mixBlendMode: "plus-darker",
    pointerEvents: "none",
});
