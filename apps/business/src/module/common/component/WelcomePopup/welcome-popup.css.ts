import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Overrides for the welcome popup. The DS AlertDialogContent defaults
 * (white surface, 16px radius, 480px) are overridden to the design spec:
 * `surface.background2` (#f9fafb), 24px radius, 448px wide, 24px padding.
 */
export const content = style({
    width: "min(448px, calc(100vw - 32px))",
    maxWidth: "min(448px, calc(100vw - 32px))",
    padding: alias.spacing.l,
    backgroundColor: vars.surface.background2,
    borderRadius: alias.cornerRadius.xl,
});

/**
 * `AlertDialogTitle`/`AlertDialogDescription` ship their own font sizes
 * (18px / 14px) that win over the `<Text>` variant when merged via `asChild`.
 * The doubled `&&` selector outranks those single-class styles so the design
 * spec sizes apply: title 20/30 SemiBold, description 16/26 Regular.
 */
export const title = style({
    selectors: {
        "&&": {
            fontSize: fontSize.xl,
            lineHeight: "30px",
        },
    },
});

export const description = style({
    selectors: {
        "&&": {
            // The DS description style adds an 8px margin-top; the Stack
            // already provides the 8px gap, so this would double it.
            marginTop: 0,
            fontSize: fontSize.m,
            lineHeight: "26px",
        },
    },
});
