import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const emptyLayout = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: alias.spacing.m,
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
