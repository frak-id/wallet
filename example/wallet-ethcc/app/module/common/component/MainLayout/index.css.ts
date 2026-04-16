import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme.css";

export const main = style({
    display: "flex",
    justifyContent: "center",
    minHeight: "100dvh",
    width: "100%",
});

export const inner = style({
    width: "100%",
    maxWidth: "720px",
    padding: vars.space.lg,
    display: "flex",
    flexDirection: "column",
    "@media": {
        "(min-width: 600px)": {
            padding: vars.space.xl,
        },
    },
});
