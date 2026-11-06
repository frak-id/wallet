import { style } from "@vanilla-extract/css";
import { fonts } from "@/shell/device.css";
import { palette, pressable } from "../components/page.css";

export const head = style({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "24px 16px 16px",
});

export const title = style({
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 1.1,
    margin: 0,
    fontWeight: 400,
});

export const shipping = style({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    margin: "0 16px",
    padding: "14px 16px",
    background: palette.accentSoft,
    fontSize: 13,
});

export const shippingText = style({
    display: "flex",
    alignItems: "center",
    gap: 8,
});

export const progressTrack = style({
    height: 3,
    overflow: "hidden",
    background: "rgba(31, 27, 22, 0.12)",
});

export const progressFill = style({
    height: "100%",
    background: palette.ink,
    transformOrigin: "left",
});

export const lines = style({
    display: "flex",
    flexDirection: "column",
    padding: "8px 16px 24px",
});

export const line = style({
    display: "flex",
    gap: 14,
    padding: "18px 0",
    borderBottom: `1px solid ${palette.line}`,
});

export const thumb = style({
    flexShrink: 0,
    width: 92,
    height: 112,
    padding: "10px 0",
    background: palette.accentSoft,
});

export const lineBody = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
});

export const lineTop = style({
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
});

export const lineName = style({
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 1.15,
});

export const lineMeta = style({ fontSize: 12, color: palette.muted });

export const lineBottom = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
});

export const stepper = style({
    display: "inline-flex",
    alignItems: "center",
    height: 36,
    border: `1px solid ${palette.line}`,
    background: "#fffdf9",
});

export const stepperButton = style([
    pressable,
    {
        display: "grid",
        placeItems: "center",
        width: 34,
        height: "100%",
        padding: 0,
        border: 0,
        background: "transparent",
        color: palette.ink,
    },
]);

export const stepperValue = style({
    minWidth: 22,
    textAlign: "center",
    fontSize: 13,
    fontWeight: 500,
});

export const remove = style({
    fontSize: 12,
    color: palette.muted,
    textDecoration: "underline",
    textUnderlineOffset: 3,
});

export const subtotal = style({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
});

export const subtotalValue = style({
    fontSize: 17,
    fontWeight: 500,
    letterSpacing: 0,
});

export const note = style({
    margin: "-4px 0 2px",
    fontSize: 11.5,
    color: palette.muted,
});
