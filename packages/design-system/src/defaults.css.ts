import { globalStyle } from "@vanilla-extract/css";
import { brand } from "./tokens.css";

globalStyle("html", {
    fontFamily: brand.typography.fontFamily.inter,
});

globalStyle("body", {
    position: "relative",
    overflow: "hidden",
    "@media": {
        "(min-width: 600px)": {
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
        },
    },
});
