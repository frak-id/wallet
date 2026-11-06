import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

const IG_GRADIENT =
    "linear-gradient(45deg, #feda75 0%, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)";

export const bare = style({
    display: "block",
    flexShrink: 0,
    borderRadius: "50%",
    overflow: "hidden",
});

export const ring = recipe({
    base: {
        display: "block",
        flexShrink: 0,
        borderRadius: "50%",
    },
    variants: {
        ring: {
            story: { padding: 2.5, background: IG_GRADIENT },
            seen: { padding: 1.5, background: "#dbdbdb" },
        },
    },
});

export const gap = style({
    display: "block",
    width: "100%",
    height: "100%",
    padding: 2.5,
    borderRadius: "50%",
    background: "#fff",
});

export const inner = style({
    display: "block",
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    overflow: "hidden",
});

export const initials = style({
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: "#fff",
    fontWeight: 600,
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.15)",
});
