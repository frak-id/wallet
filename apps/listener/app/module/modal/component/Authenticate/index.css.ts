import { style } from "@vanilla-extract/css";

/**
 * Local replacement for the deleted wallet-shared `TextData` wrapper.
 *
 * Used to preview the SIWE message inside the Authenticate modal step.
 * Styles are ported 1:1 from the original `TextData/index.module.css`
 * to avoid any visual delta on the listener.
 */
export const textData = style({
    padding: "7px",
    background: "#000b1c",
    border: "1px solid #818c9c",
    borderRadius: "var(--frak-radius-s)",
    fontSize: "12px",
    overflow: "auto",
});
