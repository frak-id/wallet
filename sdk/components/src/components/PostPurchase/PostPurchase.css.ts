import "@frak-labs/design-system/sprinkles";
import "@frak-labs/design-system/utils";
import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    borderRadius: alias.cornerRadius.m,
});

export const message = style({
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    color: vars.text.secondary,
});

export const cta = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xs,
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.surface.primary,
    color: vars.text.onAction,
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    selectors: {
        "&:disabled": {
            opacity: 0.7,
            cursor: "default",
        },
    },
});

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
