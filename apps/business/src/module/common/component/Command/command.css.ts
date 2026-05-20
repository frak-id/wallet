import { vars } from "@frak-labs/design-system/theme";
import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const command = style({
    display: "flex",
    flexDirection: "column",
    width: "var(--radix-popper-anchor-width)",
    height: "100%",
    overflow: "hidden",
});

export const commandInputWrapper = style({
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
});

export const commandInput = style({
    all: "unset",
    boxSizing: "border-box",
    padding: "9px 12px",
    width: "100%",
    lineHeight: "20px",
    color: vars.text.primary,
    fontWeight: brand.typography.fontWeight.regular,
});

export const commandList = style({
    overflowY: "auto",
    overflowX: "hidden",
    maxHeight: "300px",
});

export const commandEmpty = style({
    padding: "24px 0",
    textAlign: "center",
});

export const commandGroup = style({
    overflow: "hidden",
});

export const commandSeparator = style({
    height: "1px",
    backgroundColor: brand.colors.neutral.grey250,
});

export const commandItem = style({
    display: "flex",
    alignItems: "center",
    position: "relative",
    padding: "6px 8px",
    cursor: "pointer",
});
