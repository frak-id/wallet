import { vars } from "@frak-labs/design-system/theme";
import { alias, zIndex } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import {
    focusRing,
    focusRingInset,
} from "@/module/common/styles/interaction.css";

export const trigger = style([
    focusRing,
    {
        display: "inline-flex",
        alignItems: "center",
        gap: alias.spacing.m,
        height: "40px",
        padding: 0,
        border: "none",
        background: "transparent",
        borderRadius: alias.cornerRadius.full,
        color: vars.text.primary,
        fontFamily: "inherit",
        cursor: "pointer",
    },
]);

export const triggerContent = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const avatar = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    color: vars.icon.action,
    flexShrink: 0,
});

export const avatarIcon = style({
    width: "24px",
    height: "24px",
});

export const label = style({
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const chevron = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.tertiary,
    transition: "transform 0.15s ease",
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const chevronOpen = style({
    transform: "rotate(180deg)",
});

export const menu = style({
    // Sits above the fixed header (zIndex 1) and the sidebar nav so the
    // dropdown is not occluded when expanded over surrounding chrome.
    zIndex: zIndex.popover,
    width: "351px",
    maxWidth: "calc(100vw - 32px)",
    padding: alias.spacing.xxs,
    background: vars.surface.background,
    borderRadius: alias.cornerRadius.m,
    boxShadow: "0px 4px 16px 0px rgba(115, 115, 115, 0.2)",
});

export const list = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
});

export const item = style({});

export const merchantLink = style([
    focusRingInset,
    {
        display: "flex",
        alignItems: "center",
        gap: alias.spacing.xs,
        width: "100%",
        padding: alias.spacing.m,
        borderRadius: alias.cornerRadius.m,
        border: "4px solid transparent",
        color: vars.text.primary,
        textDecoration: "none",
        // Shared by the <a> switch link and the <button> in-place switcher used
        // on param-less routes — reset the native button chrome.
        background: "transparent",
        fontFamily: "inherit",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.15s ease",
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

export const merchantLinkActive = style({
    background: vars.surface.secondary,
    borderColor: vars.surface.elevated,
    selectors: {
        "&:hover": {
            background: vars.surface.secondary,
        },
    },
});

export const merchantBody = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    minWidth: 0,
    flex: 1,
});

export const merchantName = style({
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const merchantDomain = style({
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const check = style({
    color: vars.icon.action,
    flexShrink: 0,
});

export const divider = style({
    padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
});

export const dividerLine = style({
    display: "block",
    height: "1px",
    background: vars.border.subtle,
});

const cellBase = {
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    width: "100%",
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.s,
    color: vars.text.primary,
    textDecoration: "none",
    background: "transparent",
    border: "none",
    fontFamily: "inherit",
    textAlign: "left",
    cursor: "pointer",
    transition: "background 0.15s ease",
} as const;

export const cell = style([
    focusRingInset,
    {
        ...cellBase,
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

export const cellIcon = style({
    display: "inline-flex",
    alignItems: "center",
    color: vars.icon.action,
    flexShrink: 0,
});

export const cellIconError = style({
    color: vars.icon.error,
});
