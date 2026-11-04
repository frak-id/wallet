import { style } from "@vanilla-extract/css";
import { fonts } from "@/shell/device.css";
import { palette, pressable } from "../components/page.css";

export const hero = style({
    display: "flex",
    flexDirection: "column",
});

export const heroMedia = style({
    position: "relative",
    height: 280,
    overflow: "hidden",
    background: palette.accentSoft,
});

export const heroArt = style({
    position: "absolute",
    inset: 0,
});

export const heroText = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    padding: "22px 16px 4px",
    color: palette.ink,
});

export const heroEyebrow = style({
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: palette.muted,
});

export const heroTitle = style({
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
    margin: 0,
    fontWeight: 400,
    textWrap: "balance",
});

export const heroCta = style([
    pressable,
    {
        marginTop: 6,
        padding: "9px 18px",
        border: `1px solid ${palette.ink}`,
        background: "transparent",
        color: palette.ink,
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
    },
]);

export const section = style({ padding: "26px 0 8px" });

export const sectionHead = style({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "0 16px 14px",
});

export const sectionTitle = style({
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 1.1,
    margin: 0,
    fontWeight: 400,
});

export const rail = style({
    display: "flex",
    gap: 12,
    padding: "4px 16px 16px",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    scrollPaddingInline: 16,
    scrollbarWidth: "none",
    selectors: { "&::-webkit-scrollbar": { display: "none" } },
});

export const card = style([
    pressable,
    {
        flex: "0 0 152px",
        width: 152,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 0,
        border: 0,
        background: "transparent",
        color: "inherit",
        fontFamily: "inherit",
        textAlign: "left",
        scrollSnapAlign: "start",
    },
]);

export const cardImage = style({
    position: "relative",
    display: "block",
    width: "100%",
    height: 178,
    marginBottom: 6,
    overflow: "hidden",
    background: palette.accentSoft,
});

export const cardBadge = style({
    position: "absolute",
    top: 8,
    left: 8,
    padding: "3px 7px",
    background: palette.paper,
    color: palette.ink,
    fontSize: 9.5,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
});

export const cardName = style({
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 1.15,
});

export const cardClaim = style({
    fontSize: 11.5,
    color: palette.muted,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const cardPrice = style({
    marginTop: 2,
    fontSize: 13,
    fontWeight: 500,
});

export const story = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
    margin: "16px 16px 0",
    padding: "30px 22px",
    background: palette.accentSoft,
});

export const storyTitle = style({
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 1.12,
    margin: 0,
    fontWeight: 400,
    textWrap: "balance",
});

export const storyBody = style({
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: palette.muted,
});

export const reviews = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "36px 28px 32px",
    textAlign: "center",
});

export const score = style({
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: palette.muted,
});

export const scoreStars = style({ display: "flex", color: palette.ink });

export const scoreValue = style({
    fontFamily: fonts.serif,
    fontSize: 30,
    color: palette.ink,
});

export const quote = style({
    margin: "6px 0 0",
    fontFamily: fonts.serif,
    fontSize: 19,
    lineHeight: 1.35,
    fontStyle: "italic",
    textWrap: "balance",
});

export const author = style({
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: palette.muted,
});

export const footer = style({
    padding: "22px 16px 28px",
    borderTop: `1px solid ${palette.line}`,
    textAlign: "center",
    fontSize: 11,
    letterSpacing: "0.08em",
    color: palette.muted,
});
