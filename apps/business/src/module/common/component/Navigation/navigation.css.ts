import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { brandColors } from "@/styles/brand";

export const navigation = style({
    position: "fixed",
    left: 0,
    top: "72px",
    width: "256px",
    height: "calc(100dvh - 72px)",
    padding: "15px 28px 12px 10px",
    background: brandColors.blur,
    backdropFilter: "blur(10px)",
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
    color: brand.colors.neutral.white,
    transition:
        "background 0.15s, color 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            color: brand.colors.neutral.grey400,
        },
        "&:hover": {
            background: "rgba(245, 245, 245, 0.5)",
            color: "rgba(0, 20, 50, 1)",
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
    background: "rgba(245, 245, 245, 0.5)",
    color: "rgba(0, 20, 50, 1)",
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
