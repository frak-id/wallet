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

// ─── In-app variant (dark transparent) ───────────────────

export const inapp = style([
    base,
    rootBase,
    {
        flexDirection: "column",
        gap: alias.spacing.xxs,
        padding: `${alias.spacing.s} ${alias.spacing.m}`,
        paddingRight: alias.spacing.xl,
        borderRadius: alias.cornerRadius.m,
        backgroundColor: "#000000CC",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: "#ffffff",
    },
]);

export const inappHeader = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const inappIconWrapper = style({
    flexShrink: 0,
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
});

export const inappTitle = style([
    base,
    {
        fontSize: fontSize.m,
        fontWeight: brand.typography.fontWeight.medium,
        lineHeight: "26px",
        color: vars.text.onAction,
    },
]);

export const inappDescription = style([
    base,
    {
        fontSize: fontSize.s,
        color: vars.text.onAction,
        lineHeight: "22px",
        opacity: 0.96,
    },
]);

export const inappCta = style([
    element.button,
    {
        display: "inline-flex",
        alignItems: "center",
        gap: alias.spacing.xxs,
        color: "#2BB2FF",
        fontSize: fontSize.s,
        fontWeight: brand.typography.fontWeight.semiBold,
        textDecoration: "underline",
        textUnderlineOffset: "2px",
        selectors: {
            "&:focus-visible": {
                outline: "2px solid #2BB2FF",
                outlineOffset: "2px",
                borderRadius: alias.cornerRadius.xs,
            },
        },
    },
]);

export const inappClose = style([
    element.button,
    {
        position: "absolute",
        top: alias.spacing.xs,
        right: alias.spacing.xs,
        width: "28px",
        height: "28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: alias.cornerRadius.full,
        color: "rgba(255, 255, 255, 0.6)",
        selectors: {
            "&:focus-visible": {
                outline: "2px solid #ffffff",
                outlineOffset: "2px",
            },
        },
    },
]);

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
