import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const balance = style({
    padding: `${alias.spacing.xl} 0`,
});

export const amount = style({
    fontSize: fontSize["4xl"],
    fontWeight: "var(--brand-fontweight-semi-bold)",
    textShadow: "2px 2px 38px var(--color-wallet-navy-solid)",
});
