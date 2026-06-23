import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const content = style({
    // The DS content sets width/background on a single class with equal
    // specificity, so plain props lose to stylesheet order. `&&` (this
    // element, doubled) bumps specificity to win — scoped to this class.
    selectors: {
        "&&": {
            width: "min(448px, calc(100vw - 32px))",
            maxWidth: "448px",
            backgroundColor: vars.surface.background2,
            borderRadius: alias.cornerRadius.xl,
            padding: alias.spacing.l,
        },
    },
});

export const badgeIcon = style({
    color: vars.icon.action,
});

export const title = style({
    margin: 0,
    fontSize: fontSize.xl,
    lineHeight: "30px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.primary,
    textAlign: "center",
});

export const description = style({
    margin: 0,
    fontSize: fontSize.m,
    lineHeight: "26px",
    color: vars.text.secondary,
    textAlign: "center",
});

export const button = style({
    flex: 1,
});

export const destructiveButton = style({
    backgroundColor: vars.surface.error,
    color: vars.text.error,
    selectors: {
        "&:hover:not(:disabled)": {
            backgroundColor: alias.error[200],
        },
    },
});
