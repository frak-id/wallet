import { fadeInDown } from "@frak-labs/design-system/keyframes";
import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { base } from "@frak-labs/design-system/utils";
import { style } from "@vanilla-extract/css";
import { pressable } from "../page.css";

/* Mirrors `sdk/components/src/components/Banner/Banner.css.ts` (referral mode). */

export const slot = style({ overflow: "hidden" });

export const placement = style({ padding: "16px 16px 4px" });

export const referral = style([
    base,
    {
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: alias.spacing.m,
        padding: alias.spacing.m,
        backgroundColor: "#ffffff",
        color: vars.text.primary,
        border: `${alias.borderWidth.xs} solid ${vars.border.default}`,
        borderRadius: alias.cornerRadius.m,
        animation: `${fadeInDown} 300ms ease-out`,
    },
]);

export const iconWrapper = style({
    flexShrink: 0,
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    overflow: "hidden",
});

export const iconSvg = style({ width: "100%", height: "100%" });

export const body = style({ flex: 1, minWidth: 0 });

export const title = style([
    base,
    {
        fontSize: fontSize.m,
        fontWeight: brand.typography.fontWeight.semiBold,
        color: vars.text.primary,
        lineHeight: "22px",
    },
]);

export const description = style([
    base,
    {
        marginBottom: alias.spacing.xs,
        fontSize: fontSize.s,
        color: "#979797",
        lineHeight: "22px",
    },
]);

export const cta = style([
    pressable,
    {
        margin: 0,
        appearance: "none",
        backgroundColor: "transparent",
        fontFamily: "inherit",
        display: "inline-block",
        padding: `${alias.spacing.xs} ${alias.spacing.m}`,
        border: "1px solid #000000",
        borderRadius: alias.cornerRadius.full,
        color: vars.text.primary,
        fontSize: fontSize.xxs,
        fontWeight: brand.typography.fontWeight.bold,
        lineHeight: "12px",
        textTransform: "uppercase",
    },
]);

export const frakLogo = style({
    position: "absolute",
    right: alias.spacing.m,
    bottom: alias.spacing.s,
    pointerEvents: "none",
    color: vars.text.primary,
});
