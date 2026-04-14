import { base, element } from "@frak-labs/design-system/utils";
import "@frak-labs/design-system/sprinkles";
import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

const fadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

// ─── Shared root styles ──────────────────────────────────

const rootBase = style({
    position: "relative",
    display: "flex",
    animation: `${fadeIn} 300ms ease-out`,
});

export const iconSvg = style({
    width: "100%",
    height: "100%",
});

// ─── Referral variant (white) ────────────────────────────

export const referral = style([
    base,
    rootBase,
    {
        flexDirection: "row",
        alignItems: "center",
        gap: alias.spacing.m,
        padding: alias.spacing.m,
        backgroundColor: "#ffffff",
        color: vars.text.primary,
    },
]);

export const referralIconWrapper = style({
    flexShrink: 0,
    alignSelf: "flex-start",
    width: "40px",
    height: "40px",
});

export const referralBody = style({
    flex: 1,
    minWidth: 0,
});

export const referralTitle = style([
    base,
    {
        fontSize: fontSize.m,
        fontWeight: brand.typography.fontWeight.semiBold,
        color: vars.text.primary,
        lineHeight: "22px",
    },
]);

export const referralDescription = style([
    base,
    {
        marginBottom: alias.spacing.xs,
        fontSize: fontSize.s,
        color: "#979797",
        lineHeight: "22px",
    },
]);

export const referralCta = style([
    element.button,
    {
        display: "inline-block",
        padding: `${alias.spacing.xs} ${alias.spacing.m}`,
        border: "1px solid #000000",
        borderRadius: alias.cornerRadius.full,
        color: vars.text.primary,
        fontSize: fontSize.xxs,
        fontWeight: brand.typography.fontWeight.bold,
        lineHeight: "12px",
        textTransform: "uppercase",
        selectors: {
            "&:focus-visible": {
                outline: "2px solid #000000",
                outlineOffset: "2px",
            },
        },
    },
]);

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
