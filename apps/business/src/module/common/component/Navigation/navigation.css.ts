import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, style } from "@vanilla-extract/css";

export const navigation = style({
    position: "fixed",
    left: 0,
    top: "72px",
    width: "256px",
    height: "calc(100dvh - 72px)",
    padding: "15px 28px 12px 10px",
    background: vars.surface.elevated,
    borderRight: `1px solid ${vars.border.default}`,
    "@media": {
        "screen and (max-width: 768px)": {
            width: "48px",
            padding: "15px 5px 12px 5px",
        },
    },
});

export const navigationList = style({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    height: "100%",
});

globalStyle(`${navigationList} ul`, {
    margin: "10px 0 0 36px",
});

export const navigationItemToBottom = style({
    marginTop: "auto",
});

export const navigationItemButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    height: "52px",
    padding: "0 0 0 12px",
    borderRadius: "5px",
    cursor: "pointer",
    color: vars.text.primary,
    transition:
        "background 0.15s, color 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            color: vars.text.disabled,
        },
        "&:hover": {
            background: vars.surface.muted,
            color: vars.text.action,
        },
    },
    "@media": {
        "screen and (max-width: 768px)": {
            justifyContent: "center",
            padding: 0,
        },
    },
});

export const navigationItemButtonActive = style({
    background: vars.surface.secondary,
    color: vars.text.action,
});

export const navigationItemRightSection = style({
    marginRight: "5px",
    marginLeft: "auto",
});

export const navigationItemLabel = style({
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});
