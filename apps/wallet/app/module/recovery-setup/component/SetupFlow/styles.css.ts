import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    paddingInline: alias.spacing.m,
    marginTop: alias.spacing.m,
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    width: "100%",
});

export const form = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const field = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const blob = style({
    fontFamily: "monospace",
    fontSize: "0.8rem",
    lineHeight: 1.6,
    wordBreak: "break-all",
    userSelect: "all",
});

export const blobActions = style({
    display: "flex",
    gap: alias.spacing.s,
});
