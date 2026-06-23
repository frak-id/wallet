import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const trigger = style({
    cursor: "pointer",
    border: "none",
    padding: 0,
    background: "none",
    textAlign: "left",
    color: "inherit",
});

export const close = style({
    all: "unset",
    position: "absolute",
    top: "15px",
    right: "15px",
    cursor: "pointer",
});

export const content = style({
    maxWidth: "850px",
    color: brand.colors.neutral.grey700,
});

export const withCloseButton = style({
    paddingTop: "17px",
});

export const footer = style({
    display: "flex",
    justifyContent: "flex-end",
    gap: "14px",
    padding: "15px 0 0 0",
});

export const footerAfter = style({
    padding: "15px 0 0 0",
    textAlign: "center",
});
