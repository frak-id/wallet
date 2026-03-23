import type { ConditionalValue } from "@vanilla-extract/sprinkles";
import { createSprinkles, defineProperties } from "@vanilla-extract/sprinkles";

import { breakpointNames } from "./breakpoints";
import { vars } from "./theme.css";
import { alias, brand, fontSize } from "./tokens.css";

const spacingScale = {
    none: alias.spacing.none,
    xs: alias.spacing.xs,
    s: alias.spacing.s,
    m: alias.spacing.m,
    l: alias.spacing.l,
    xl: alias.spacing.xl,
} as const;

const radiusScale = {
    none: alias.cornerRadius.none,
    xs: alias.cornerRadius.xs,
    s: alias.cornerRadius.s,
    m: alias.cornerRadius.m,
    l: alias.cornerRadius.l,
    xl: alias.cornerRadius.xl,
    full: alias.cornerRadius.full,
} as const;

const responsiveProperties = defineProperties({
    conditions: {
        mobile: {},
        tablet: { "@media": "screen and (min-width: 768px)" },
        desktop: { "@media": "screen and (min-width: 1024px)" },
    },
    defaultCondition: "mobile",
    responsiveArray: breakpointNames,
    properties: {
        display: ["none", "flex", "block", "grid", "inline-flex"],
        flexDirection: ["row", "column"],
        alignItems: ["stretch", "flex-start", "center", "flex-end", "baseline"],
        justifyContent: [
            "stretch",
            "flex-start",
            "center",
            "flex-end",
            "space-between",
            "space-around",
        ],
        flexWrap: ["nowrap", "wrap", "wrap-reverse"],
        gap: spacingScale,
        paddingTop: spacingScale,
        paddingBottom: spacingScale,
        paddingLeft: spacingScale,
        paddingRight: spacingScale,
        marginTop: spacingScale,
        marginBottom: spacingScale,
        marginLeft: spacingScale,
        marginRight: spacingScale,
        borderRadius: radiusScale,
    },
    shorthands: {
        padding: ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"],
        paddingX: ["paddingLeft", "paddingRight"],
        paddingY: ["paddingTop", "paddingBottom"],
        marginX: ["marginLeft", "marginRight"],
        marginY: ["marginTop", "marginBottom"],
    },
});

const unresponsiveProperties = defineProperties({
    properties: {
        position: ["relative", "absolute", "fixed", "sticky"],
        overflow: ["hidden", "scroll", "visible", "auto"],
        cursor: ["default", "pointer"],
        flexShrink: [0],
        flexGrow: [0, 1],
        textAlign: ["left", "center", "right"],
        fontSize: {
            xs: fontSize.xs,
            s: fontSize.s,
            m: fontSize.m,
            l: fontSize.l,
            xl: fontSize.xl,
            "2xl": fontSize["2xl"],
            "3xl": fontSize["3xl"],
            "4xl": fontSize["4xl"],
            "5xl": fontSize["5xl"],
        },
        fontWeight: {
            regular: String(brand.typography.fontWeight.regular),
            medium: String(brand.typography.fontWeight.medium),
            semiBold: String(brand.typography.fontWeight.semiBold),
            bold: String(brand.typography.fontWeight.bold),
        },
    },
});

const colorProperties = defineProperties({
    conditions: {
        lightMode: {},
        darkMode: { selector: "[data-theme='dark'] &" },
    },
    defaultCondition: "lightMode",
    properties: {
        color: {
            primary: vars.text.primary,
            secondary: vars.text.secondary,
            tertiary: vars.text.tertiary,
            disabled: vars.text.disabled,
            action: vars.text.action,
            onAction: vars.text.onAction,
            error: vars.text.error,
            success: vars.text.success,
            warning: vars.text.warning,
        },
        backgroundColor: {
            primary: vars.surface.primary,
            secondary: vars.surface.secondary,
            background: vars.surface.background,
            elevated: vars.surface.elevated,
            muted: vars.surface.muted,
            tertiary: vars.surface.tertiary,
            disabled: vars.surface.disabled,
            error: vars.surface.error,
            success: vars.surface.success,
            warning: vars.surface.warning,
        },
    },
});

export const sprinkles = createSprinkles(
    responsiveProperties,
    unresponsiveProperties,
    colorProperties
);

export type Sprinkles = Parameters<typeof sprinkles>[0];

export type ResponsiveValue<T extends string | number | boolean> =
    ConditionalValue<typeof responsiveProperties, T>;

export type ColorModeValue<T extends string | number | boolean> =
    ConditionalValue<typeof colorProperties, T>;

export type ResponsiveSpace = ResponsiveValue<keyof typeof spacingScale>;
