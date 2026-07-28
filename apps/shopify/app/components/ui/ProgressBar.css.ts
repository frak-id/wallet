import { style } from "@vanilla-extract/css";

export const progressBar = style({
    width: "100%",
    borderRadius: 4,
    overflow: "hidden",
});

export const small = style({
    height: 4,
});

export const medium = style({
    height: 8,
});

export const fill = style({
    height: "100%",
    backgroundColor: "#008060",
    transition: "width 0.3s ease-in-out",
});
