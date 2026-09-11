import { tablet } from "@frak-labs/design-system/breakpoints";
import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";
import { focusRing } from "@/module/common/styles/interaction.css";

export const navigation = style({
    position: "fixed",
    left: 0,
    top: 0,
    width: "64px",
    height: "100dvh",
    padding: "16px 8px",
    background: vars.surface.background,
    borderRight: `1px solid ${vars.border.subtle}`,
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            width: "240px",
            padding: "48px 32px",
        },
    },
});

export const logoWrapper = style({
    color: vars.text.primary,
    marginBottom: alias.spacing.m,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            justifyContent: "flex-start",
            marginBottom: alias.spacing.l,
        },
    },
});

export const logoFull = style({
    display: "none",
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            display: "block",
        },
    },
});

export const logoBadge = style({
    display: "block",
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            display: "none",
        },
    },
});

// Also applied to the nested submenu <ul> (NavigationCampaignsSwitcher).
export const itemList = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});

const slideDown = keyframes({
    from: { height: 0 },
    to: { height: "var(--radix-collapsible-content-height)" },
});

const slideUp = keyframes({
    from: { height: "var(--radix-collapsible-content-height)" },
    to: { height: 0 },
});

export const collapsibleContent = style({
    overflow: "hidden",
    selectors: {
        '&[data-state="open"]': {
            animation: `${slideDown} 150ms cubic-bezier(0.4, 0, 0.2, 1)`,
        },
        '&[data-state="closed"]': {
            animation: `${slideUp} 150ms cubic-bezier(0.4, 0, 0.2, 1)`,
        },
    },
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            selectors: {
                '&[data-state="open"]': { animation: "none" },
                '&[data-state="closed"]': { animation: "none" },
            },
        },
    },
});

export const sectionLabel = style({
    listStyle: "none",
    padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
    display: "none",
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            display: "list-item",
        },
    },
});

export const divider = style({
    border: 0,
    borderTop: `1px solid ${vars.border.subtle}`,
    margin: 0,
    width: "100%",
});

const itemBase = style([
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: alias.spacing.xs,
        width: "100%",
        height: "36px",
        paddingLeft: alias.spacing.s,
        paddingRight: alias.spacing.s,
        borderRadius: alias.cornerRadius.m,
        cursor: "pointer",
        color: vars.text.secondary,
        transition: "background 0.15s ease, color 0.15s ease",
        selectors: {
            // `aria-disabled` mirrors `:disabled` — used when the item still needs
            // hover/focus events (e.g. to show a tooltip), which a native disabled
            // button would swallow.
            "&:disabled": {
                cursor: "not-allowed",
                color: vars.text.disabled,
            },
            '&[aria-disabled="true"]': {
                cursor: "not-allowed",
                color: vars.text.disabled,
            },
        },
    },
]);

export const itemListEntry = style({
    listStyle: "none",
});

export const item = style([
    itemBase,
    {
        justifyContent: "center",
        padding: 0,
        "@media": {
            "(hover: hover)": {
                selectors: {
                    "&:not(:disabled):not([aria-disabled='true']):hover": {
                        background: vars.surface.muted,
                        color: vars.text.action,
                    },
                },
            },
            [`screen and (min-width: ${tablet}px)`]: {
                justifyContent: "normal",
                paddingLeft: alias.spacing.s,
                paddingRight: alias.spacing.s,
            },
        },
    },
]);

export const itemActive = style({
    color: vars.text.action,
});

export const subItem = style([
    itemBase,
    {
        paddingLeft: "40px",
        display: "none",
        "@media": {
            "(hover: hover)": {
                selectors: {
                    "&:not(:disabled):not([aria-disabled='true']):hover": {
                        background: brand.colors.neutral.grey200,
                        color: vars.text.action,
                    },
                },
            },
            [`screen and (min-width: ${tablet}px)`]: {
                display: "flex",
            },
        },
    },
]);

export const subItemActive = style({
    background: brand.colors.neutral.grey200,
    color: vars.text.action,
});

export const itemIcon = style({
    flexShrink: 0,
    display: "inline-flex",
});

export const itemLabel = style({
    flexGrow: 1,
    display: "none",
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            display: "inline",
        },
    },
});

export const itemRight = style({
    marginLeft: "auto",
    display: "none",
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            display: "inline-flex",
        },
    },
});
