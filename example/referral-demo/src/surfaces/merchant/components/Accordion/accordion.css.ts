import { style } from "@vanilla-extract/css";
import { palette, pressable } from "../page.css";

export const item = style({ borderBottom: `1px solid ${palette.line}` });

export const trigger = style([
    pressable,
    {
        appearance: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: 54,
        padding: 0,
        border: 0,
        background: "transparent",
        color: palette.ink,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        selectors: { "&:active": { transform: "none" } },
    },
]);

export const chevron = style({ transition: "transform 240ms ease" });

export const chevronOpen = style({ transform: "rotate(180deg)" });

export const panel = style({ overflow: "hidden" });

export const body = style({
    margin: 0,
    paddingBottom: 18,
    fontSize: 13.5,
    lineHeight: 1.6,
    color: palette.muted,
});
