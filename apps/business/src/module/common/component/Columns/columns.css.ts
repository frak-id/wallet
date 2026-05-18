import { alias } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const columns = recipe({
    base: {
        display: "flex",
        gap: "10px",
        width: "100%",
    },
    variants: {
        align: {
            start: { alignItems: "flex-start" },
            center: { alignItems: "center" },
        },
    },
    defaultVariants: {
        align: "center",
    },
});

export const columnsRoot = style({});

globalStyle(`${columnsRoot} + ${columnsRoot}`, {
    marginTop: "24px",
});

export const column = recipe({
    base: {
        flexBasis: "50%",
    },
    variants: {
        size: {
            none: { flexGrow: "initial", flexBasis: "auto" },
            full: { flexGrow: "initial", flexBasis: "100%" },
            threeQuarter: { flexGrow: "initial", flexBasis: "75%" },
            oneQuarter: { flexGrow: "initial", flexBasis: "25%" },
        },
        justify: {
            start: {},
            end: {},
        },
    },
    defaultVariants: {
        justify: "end",
    },
});

export const columnRoot = style({});

globalStyle(`${columnRoot} + ${columnRoot}`, {
    display: "flex",
    gap: alias.spacing.s,
});

globalStyle(`${columnRoot} + ${columnRoot}[data-justify="start"]`, {
    justifyContent: "flex-start",
});

globalStyle(`${columnRoot} + ${columnRoot}[data-justify="end"]`, {
    justifyContent: "flex-end",
});
