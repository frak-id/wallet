import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const list = style({});

export const empty = style({
    minHeight: 300,
    textAlign: "center",
});

export const emptyIcon = style({
    color: "var(--frak-text-color)",
    opacity: 0.4,
    marginBottom: alias.spacing.xs,
});

export const emptyTitle = style({});

export const emptyDescription = style({
    opacity: 0.6,
    maxWidth: 240,
    lineHeight: 1.4,
});

export const itemMerchant = style({
    fontWeight: 600,
});

export const itemAmount = style({
    fontWeight: 700,
    color: "var(--frak-color-green)",
    whiteSpace: "nowrap",
});

export const itemDate = style({
    color: "var(--frak-color-grayText)",
});

export const itemTxHash = style({
    fontFamily: "monospace",
    color: "var(--frak-color-grayText)",
});
