import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { shop } from "../components/checkout.css";
import { palette } from "../components/page.css";

export const main = style({
    display: "flex",
    flexDirection: "column",
    gap: 18,
    padding: "22px 16px 36px",
});

export const head = style({
    display: "flex",
    alignItems: "center",
    gap: 14,
});

export const headCheck = style({
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: `2px solid ${palette.ink}`,
    color: palette.ink,
});

export const headText = style({
    display: "flex",
    flexDirection: "column",
    gap: 2,
});

export const orderNumber = style({ fontSize: 13, color: shop.muted });

export const thanks = style({
    margin: 0,
    fontSize: 23,
    fontWeight: 600,
    letterSpacing: "-0.01em",
});

export const boxBody = style({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 16,
});

export const boxTitle = style({
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
});

export const boxText = style({
    margin: 0,
    fontSize: 13.5,
    lineHeight: 1.5,
    color: shop.muted,
});

export const timeline = style({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    marginTop: 8,
});

export const step = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingTop: 20,
    fontSize: 12.5,
});

export const stepTrack = recipe({
    base: {
        position: "absolute",
        top: 5,
        left: 0,
        right: 0,
        height: 2,
        background: shop.border,
    },
    variants: {
        done: { true: { background: palette.ink }, false: {} },
    },
});

export const stepDot = recipe({
    base: {
        position: "absolute",
        top: 0,
        left: 0,
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: `2px solid ${shop.border}`,
        background: "#fff",
    },
    variants: {
        done: {
            true: { borderColor: palette.ink, background: palette.ink },
            false: {},
        },
    },
});

export const stepLabel = style({ fontWeight: 600 });

export const stepDate = style({ color: shop.muted });

export const infoGrid = style({
    display: "flex",
    flexDirection: "column",
    gap: 14,
});

export const infoItem = style({
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 13.5,
    lineHeight: 1.45,
});

export const infoLabel = style({
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 2,
});

export const infoMuted = style({ color: shop.muted });

export const footer = style({
    display: "flex",
    flexDirection: "column",
    gap: 16,
    alignItems: "stretch",
    marginTop: 4,
});

export const help = style({
    fontSize: 13,
    color: palette.accent,
    textDecoration: "underline",
    textUnderlineOffset: 3,
    textAlign: "center",
});

export const toast = style({
    position: "absolute",
    bottom: 20,
    left: "50%",
    zIndex: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px 10px 12px",
    borderRadius: 999,
    background: "rgba(28, 28, 30, 0.92)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: "nowrap",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
    pointerEvents: "none",
});

export const toastIcon = style({
    display: "grid",
    placeItems: "center",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#09be67",
    color: "#fff",
});
