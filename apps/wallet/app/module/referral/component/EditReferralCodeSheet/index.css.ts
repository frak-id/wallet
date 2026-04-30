import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const sheet = style({
    display: "flex",
    flexDirection: "column",
    paddingInline: alias.spacing.m,
    paddingTop: alias.spacing.m,
    paddingBottom: alias.spacing.l,
});

export const header = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingBlock: alias.spacing.s,
});

export const cancelButton = style({
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
});
