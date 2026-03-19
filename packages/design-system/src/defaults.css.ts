import { globalStyle } from "@vanilla-extract/css";
import { tablet } from "./breakpoints";
import { brand } from "./tokens.css";

globalStyle("html", {
    fontFamily: brand.typography.fontFamily.inter,
});

globalStyle("body", {
    position: "relative",
    overflow: "hidden",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
        },
    },
});
