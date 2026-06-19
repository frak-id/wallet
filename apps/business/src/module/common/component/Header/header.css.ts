import { vars } from "@frak-labs/design-system/theme";
import { alias, easing, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { focusRing } from "@/module/common/styles/interaction.css";

export const header = style({
    position: "fixed",
    top: 0,
    left: "240px",
    right: 0,
    zIndex: 1,
    height: "70px",
    padding: `0 ${alias.spacing.l}`,
    background: vars.surface.background,
    borderBottom: `1px solid ${vars.border.subtle}`,
    "@media": {
        "screen and (max-width: 768px)": {
            left: "64px",
            padding: `0 ${alias.spacing.s}`,
        },
    },
});

export const headerInner = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "100%",
    gap: alias.spacing.m,
});

export const headerLeft = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    minWidth: 0,
    flexShrink: 1,
    overflow: "hidden",
});

export const headerRight = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.l,
    flexShrink: 0,
    "@media": {
        "screen and (max-width: 768px)": {
            gap: alias.spacing.s,
        },
    },
});

export const breadcrumb = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const breadcrumbLink = style([
    focusRing,
    {
        display: "inline-flex",
        alignItems: "center",
        padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
        borderRadius: alias.cornerRadius.m,
        color: vars.text.tertiary,
        textDecoration: "none",
        transition: `background ${transition.fast} ${easing.default}, color ${transition.fast} ${easing.default}`,
        "@media": {
            "(hover: hover)": {
                selectors: {
                    "&:hover": {
                        background: vars.surface.muted,
                    },
                },
            },
        },
    },
]);

export const breadcrumbSeparator = style({
    color: vars.text.tertiary,
});

export const breadcrumbCurrent = style({
    color: vars.text.primary,
    padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
});

export const actionGroup = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    "@media": {
        "screen and (max-width: 768px)": {
            gap: alias.spacing.xs,
        },
    },
});

export const demoModeLink = style([
    focusRing,
    {
        display: "inline-flex",
        textDecoration: "none",
        borderRadius: alias.cornerRadius.full,
    },
]);

export const hideOnMobile = style({
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});
