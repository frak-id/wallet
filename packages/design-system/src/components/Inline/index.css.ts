import { globalStyle, style } from "@vanilla-extract/css";

export const fill = style({
    flexWrap: "nowrap",
});

globalStyle(`${fill} > * + *`, {
    flexGrow: 1,
    minWidth: 0,
});
