import { alias, fontSize, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const historyPanel = style({
    marginBottom: alias.spacing.l,
});

export const historyNav = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xs,
});

export const historyButton = style({
    all: "unset",
    fontSize: fontSize.l,
    fontWeight: "var(--brand-fontweight-semi-bold)",
    transition: `color ${transition.slow}`,
    cursor: "pointer",
});

export const historyActive = style({
    color: "var(--frak-color-black)",
});
