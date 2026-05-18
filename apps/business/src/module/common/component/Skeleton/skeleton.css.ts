import { globalStyle, style } from "@vanilla-extract/css";

export const skeleton = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "20px",
    width: "100%",
});

globalStyle(`${skeleton} br`, {
    display: "none",
});

globalStyle(`${skeleton} + ${skeleton}`, {
    marginTop: "30px",
});
