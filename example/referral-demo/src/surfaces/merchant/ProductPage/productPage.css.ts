import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { fonts } from "@/shell/device.css";
import { palette } from "../components/page.css";

export const gallery = style({
    position: "relative",
    height: 330,
    background: palette.accentSoft,
});

export const slides = style({
    display: "flex",
    height: "100%",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    scrollbarWidth: "none",
    selectors: { "&::-webkit-scrollbar": { display: "none" } },
});

export const slide = style({
    position: "relative",
    flex: "0 0 100%",
    height: "100%",
    scrollSnapAlign: "start",
    overflow: "hidden",
});

export const slideTint = recipe({
    base: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    variants: {
        tone: {
            packshot: {},
            cutout: { background: palette.line, padding: "36px 0" },
            texture: {
                background: `radial-gradient(120% 80% at 30% 30%, #fbe7c9 0%, #f3c98f 38%, ${palette.accentSoft} 72%)`,
            },
        },
    },
});

export const drop = style({
    width: 150,
    height: 150,
    borderRadius: "62% 38% 55% 45% / 48% 60% 40% 52%",
    background:
        "radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.9) 0 8%, rgba(255, 236, 196, 0.75) 14%, rgba(236, 168, 84, 0.55) 55%, rgba(180, 83, 42, 0.35) 100%)",
    boxShadow:
        "inset -8px -10px 24px rgba(180, 83, 42, 0.25), 0 18px 36px rgba(31, 27, 22, 0.12)",
    transform: "rotate(-12deg)",
});

export const dots = style({
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    display: "flex",
    justifyContent: "center",
    gap: 6,
    pointerEvents: "none",
});

export const dot = recipe({
    base: {
        width: 6,
        height: 6,
        borderRadius: 3,
        background: "rgba(31, 27, 22, 0.25)",
        transition: "width 200ms ease, background 200ms ease",
    },
    variants: {
        active: { true: { width: 18, background: palette.ink } },
    },
});

export const info = style({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "22px 16px 8px",
});

export const name = style({
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 1.08,
    margin: 0,
    fontWeight: 400,
    letterSpacing: "-0.015em",
});

export const claim = style({
    margin: 0,
    fontSize: 13,
    color: palette.muted,
});

export const priceRow = style({
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    marginTop: 4,
});

export const price = style({ fontSize: 20, fontWeight: 500 });

export const taxes = style({ fontSize: 12, color: palette.muted });

export const option = style({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
});

export const optionLabel = style({
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
});

export const chip = style({
    alignSelf: "flex-start",
    padding: "8px 16px",
    border: `1px solid ${palette.ink}`,
    fontSize: 13,
});

export const description = style({
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
});

export const perks = style({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    margin: "10px 0 6px",
    padding: "16px 0",
    borderTop: `1px solid ${palette.line}`,
    borderBottom: `1px solid ${palette.line}`,
});

export const perk = style({
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 13,
});

export const accordions = style({ padding: "0 16px 28px" });

export const backdrop = style({
    position: "absolute",
    inset: 0,
    zIndex: 4,
    background: "rgba(31, 27, 22, 0.38)",
});

export const drawer = style({
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "18px 16px 18px",
    background: palette.paper,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    boxShadow: "0 -8px 30px rgba(31, 27, 22, 0.18)",
});

export const drawerHead = style({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
});

export const drawerCheck = style({
    display: "grid",
    placeItems: "center",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: palette.ink,
    color: palette.paper,
});

export const drawerLine = style({
    display: "flex",
    alignItems: "center",
    gap: 14,
});

export const drawerThumb = style({
    flexShrink: 0,
    width: 64,
    height: 72,
    padding: "6px 0",
    background: palette.accentSoft,
});

export const drawerText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
});

export const drawerName = style({ fontFamily: fonts.serif, fontSize: 17 });

export const drawerActions = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
});
