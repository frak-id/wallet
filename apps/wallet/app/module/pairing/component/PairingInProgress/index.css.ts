import { style } from "@vanilla-extract/css";

/**
 * Inline toast wrapper — keeps the warning badge horizontally centered
 * inside the AppShell's flex column without stretching it to the full
 * container width.
 */
export const toast = style({
    display: "flex",
    justifyContent: "center",
});
