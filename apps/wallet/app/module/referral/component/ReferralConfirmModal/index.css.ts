import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    width: "100%",
});

export const content = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    alignItems: "center",
    width: "100%",
});

export const text = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    width: "100%",
    textAlign: "center",
    // An explicit `\n` in a translation breaks the line wherever the width falls.
    whiteSpace: "pre-line",
});

export const actions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
});
