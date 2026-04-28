import "@frak-labs/design-system/sprinkles";
import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { element } from "@frak-labs/design-system/utils";
import { style } from "@vanilla-extract/css";

export const card = style({
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.background,
    border: `1px solid ${vars.border.default}`,
});

export const badge = style({
    alignSelf: "flex-start",
    backgroundColor: "#FFF534",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: "12px",
    color: vars.text.primary,
});

export const message = style({
    margin: 0,
    fontSize: "16px",
    lineHeight: "22px",
    color: vars.text.primary,
    fontWeight: 600,
});

export const cta = style([
    element.button,
    {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: alias.spacing.xxs,
        padding: `${alias.spacing.s} ${alias.spacing.m}`,
        borderRadius: alias.cornerRadius.full,
        backgroundColor: vars.text.primary,
        color: vars.text.onAction,
        fontSize: "12px",
        fontWeight: "bold",
        textTransform: "uppercase",
        cursor: "pointer",
        selectors: {
            "&:disabled": {
                opacity: 0.7,
                cursor: "default",
            },
        },
    },
]);

export const icon = style({
    margin: "-2px 0",
});

export const giftIcon = style({
    display: "block",
    flexShrink: 0,
});

export const frakLogo = style({
    display: "block",
    marginLeft: "auto",
    color: vars.surface.primary,
});

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
