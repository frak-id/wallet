import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: "0.5rem",
});

export const text = style({
    fontSize: "1rem",
    color: "rgba(255, 255, 255, 0.85)",
});
