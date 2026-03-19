import { style } from "@vanilla-extract/css";
import { zIndex } from "@/tokens.css";

export const demoTap = style({
    position: "fixed",
    top: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
    left: 0,
    width: "100px",
    height: "47px",
    background: "transparent",
    border: "none",
    cursor: "default",
    zIndex: zIndex.dropdown + 1,
    padding: 0,
    WebkitTapHighlightColor: "transparent",
});
