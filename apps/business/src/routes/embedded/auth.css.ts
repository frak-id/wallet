import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "1rem",
});

export const title = style({
    marginBottom: "1.5rem",
});

export const button = style({
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
});
