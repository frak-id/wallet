import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const cardContainer = style({
    overflow: "hidden",
    borderRadius: alias.cornerRadius.xl,
    position: "relative",
});

export const layoutRow = style({
    display: "flex",
    flexDirection: "row",
    width: "100%",
    height: "130px",
});

export const contentArea = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    padding: alias.spacing.m,
    flex: "1 1 70%",
});

export const checkItem = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: alias.spacing.xxs,
});

export const checkItemIcon = style({
    display: "flex",
    width: "12px",
    height: "12px",
});

export const logosSection = style({
    flex: "0 0 30%",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const logosImage = style({
    width: "100%",
    height: "auto",
    objectFit: "contain",
});

export const closeButton = style({
    position: "absolute",
    top: alias.spacing.xs,
    right: alias.spacing.xs,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: alias.spacing.xxs,
    color: vars.icon.secondary,
});
