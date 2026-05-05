import { style } from "@vanilla-extract/css";

export const gate = style({
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    background: `linear-gradient(
        208deg,
        #1a2a4a 0%,
        #0f1a2e 50%,
        #0a0f1a 100%
    )`,
});

export const logo = style({
    width: "120px",
    height: "auto",
    marginBottom: "16px",
});
