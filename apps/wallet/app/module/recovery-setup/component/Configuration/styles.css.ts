import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Single-item accordion: drop the trailing divider so it reads as a card. */
export const accordionItem = style({
    borderBottom: "none",
});

/** Breathing room between the accordion trigger and its revealed form. */
export const testContent = style({
    paddingTop: alias.spacing.m,
});

/** Center the demoted, low-emphasis destructive action. */
export const deleteWrapper = style({
    display: "flex",
    justifyContent: "center",
});
