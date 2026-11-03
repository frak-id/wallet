import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

function studio(wall: string, wallLow: string, floor: string): string {
    return [
        "radial-gradient(90% 70% at 28% 18%, rgba(255, 255, 255, 0.6), transparent 70%)",
        "radial-gradient(60% 20% at 50% 86%, rgba(255, 255, 255, 0.35), transparent 100%)",
        `linear-gradient(180deg, ${wall} 0%, ${wallLow} 68%, ${floor} 80%, ${wallLow} 100%)`,
    ].join(", ");
}

export const packshot = recipe({
    base: {
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
    },
    variants: {
        product: {
            serum: { background: studio("#f2e2d1", "#e8cfb7", "#f4e6d8") },
            cream: { background: studio("#eeeae4", "#ddd6cc", "#f2eee8") },
            cleanser: { background: studio("#e6ebdf", "#d2dbc8", "#ebefe5") },
            balm: { background: studio("#f6e3dc", "#ebcbc0", "#f8e9e3") },
            mask: { background: studio("#e2e4ee", "#c9cddd", "#e9eaf2") },
        },
    },
});

export const packshotProduct = style({
    position: "absolute",
    left: "12%",
    right: "12%",
    top: "12%",
    bottom: "15%",
    width: "76%",
    height: "73%",
    overflow: "visible",
});
