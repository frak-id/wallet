import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { deviceInset, fonts } from "@/shell/device.css";

export const screen = style({
    position: "absolute",
    inset: 0,
    overflowY: "auto",
    overscrollBehaviorY: "contain",
    background: vars.surface.background2,
    color: vars.text.primary,
    fontFamily: fonts.inter,
});

export const column = style({
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
    paddingTop: deviceInset.top,
});

export const toolbar = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${alias.spacing.m} ${alias.spacing.m} 0`,
});

export const title = style({
    margin: 0,
    padding: `${alias.spacing.m} ${alias.spacing.m} ${alias.spacing.xs}`,
    fontSize: fontSize["3xl"],
    fontWeight: brand.typography.fontWeight.bold,
    lineHeight: "38px",
});

export const body = style({
    flexGrow: 1,
    paddingInline: alias.spacing.m,
});

export const footer = style({
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
    paddingBottom: `max(${alias.spacing.xl}, ${deviceInset.bottom})`,
    background: vars.surface.background2,
});

export const linkButton = style({
    padding: 0,
    margin: 0,
    border: "none",
    background: "none",
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
});

export const page = style({
    position: "absolute",
    inset: 0,
});
