import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, keyframes, style } from "@vanilla-extract/css";

export const navigation = style({
    position: "fixed",
    left: 0,
    top: 0,
    width: "240px",
    height: "100dvh",
    padding: "48px 32px",
    background: vars.surface.background,
    borderRight: `1px solid ${vars.border.subtle}`,
    "@media": {
        "screen and (max-width: 768px)": {
            width: "64px",
            padding: "16px 8px",
        },
    },
});

export const logoWrapper = style({
    color: vars.text.primary,
    marginBottom: alias.spacing.l,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    "@media": {
        "screen and (max-width: 768px)": {
            justifyContent: "center",
            marginBottom: alias.spacing.m,
        },
    },
});

export const logoFull = style({
    display: "block",
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const logoBadge = style({
    display: "none",
    "@media": {
        "screen and (max-width: 768px)": {
            display: "block",
        },
    },
});

export const itemList = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});

globalStyle(`${itemList} ul`, {
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
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const divider = style({
    border: 0,
    borderTop: `1px solid ${vars.border.subtle}`,
    margin: 0,
    width: "100%",
});

const itemBase = style({
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
        "&:disabled": {
            cursor: "not-allowed",
            color: vars.text.disabled,
        },
    },
});

export const itemListEntry = style({
    listStyle: "none",
});

export const item = style([
    itemBase,
    {
        "@media": {
            "(hover: hover)": {
                selectors: {
                    "&:hover": {
                        background: vars.surface.muted,
                        color: vars.text.action,
                    },
                },
            },
            "screen and (max-width: 768px)": {
                justifyContent: "center",
                padding: 0,
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
        "@media": {
            "(hover: hover)": {
                selectors: {
                    "&:hover": {
                        background: brand.colors.neutral.grey200,
                        color: vars.text.action,
                    },
                },
            },
            "screen and (max-width: 768px)": {
                display: "none",
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
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const itemRight = style({
    marginLeft: "auto",
    display: "inline-flex",
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});
