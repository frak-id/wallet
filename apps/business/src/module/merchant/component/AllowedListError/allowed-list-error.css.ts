import { style } from "@vanilla-extract/css";

/** Inherits the error colour of the surrounding text; underline carries it. */
export const supportLink = style({
    color: "inherit",
    textDecoration: "underline",
});
