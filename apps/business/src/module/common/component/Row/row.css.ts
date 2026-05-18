import { recipe } from "@vanilla-extract/recipes";

export const row = recipe({
    base: {
        display: "flex",
        flexWrap: "wrap",
        gap: "14px",
    },
    variants: {
        align: {
            start: { alignItems: "flex-start" },
            center: { alignItems: "center" },
            end: { alignItems: "flex-end" },
        },
    },
});
