import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { shop } from "../components/checkout.css";
import { palette, pressable } from "../components/page.css";

export const band = style({
    background: shop.band,
    borderBottom: `1px solid ${shop.border}`,
});

export const toggle = style([
    pressable,
    {
        appearance: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: 58,
        padding: "0 16px",
        border: 0,
        background: "transparent",
        color: palette.accent,
        fontFamily: "inherit",
        fontSize: 14,
        selectors: { "&:active": { transform: "none" } },
    },
]);

export const toggleLabel = style({
    display: "flex",
    alignItems: "center",
    gap: 6,
});

export const toggleTotal = style({
    color: "#1a1a1a",
    fontSize: 17,
    fontWeight: 600,
});

export const chevron = style({ transition: "transform 220ms ease" });

export const chevronOpen = style({ transform: "rotate(180deg)" });

export const summaryPanel = style({ overflow: "hidden" });

export const summaryInner = style({ padding: "8px 16px 20px" });

export const main = style({
    display: "flex",
    flexDirection: "column",
    gap: 30,
    padding: "20px 16px 36px",
});

export const express = style({
    display: "flex",
    flexDirection: "column",
    gap: 12,
});

export const expressLabel = style({
    textAlign: "center",
    fontSize: 13,
    color: shop.muted,
});

export const divider = style({
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    fontSize: 12,
    color: shop.muted,
    selectors: {
        "&::before, &::after": {
            content: "''",
            flex: 1,
            height: 1,
            background: shop.border,
        },
    },
});

export const fields = style({
    display: "flex",
    flexDirection: "column",
    gap: 12,
});

export const fieldRow = style({
    display: "flex",
    gap: 12,
});

export const field = style({
    position: "relative",
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minHeight: 52,
    padding: "0 12px",
    border: `1px solid ${shop.border}`,
    borderRadius: 5,
    background: "#fff",
});

export const fieldLabel = style({
    fontSize: 11.5,
    lineHeight: 1.3,
    color: shop.muted,
});

export const fieldValue = style({
    fontSize: 14,
    lineHeight: 1.35,
    color: "#1a1a1a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const selectChevron = style({
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -8,
    color: shop.muted,
});

export const checkbox = style({
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13.5,
});

export const checkboxBox = style({
    width: 18,
    height: 18,
    borderRadius: 4,
    border: `1px solid ${shop.border}`,
    background: "#fff",
});

export const option = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 14px",
        fontSize: 14,
    },
    variants: {
        selected: {
            true: {
                background: "#faf7f3",
                boxShadow: `inset 0 0 0 1px ${palette.ink}`,
                borderRadius: 6,
            },
            false: {},
        },
    },
});

export const optionStack = style({
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
});

export const optionSeparator = style({
    height: 1,
    background: shop.border,
});

export const optionText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
});

export const radio = recipe({
    base: {
        flexShrink: 0,
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: `1px solid ${shop.border}`,
        background: "#fff",
    },
    variants: {
        selected: {
            true: { border: `6px solid ${palette.ink}` },
            false: {},
        },
    },
});

export const optionStrong = style({
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
});

export const cardLogos = style({
    display: "flex",
    gap: 4,
});

export const cardLogo = style({
    padding: "2px 5px",
    border: `1px solid ${shop.border}`,
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 800,
    fontStyle: "italic",
    color: "#1a1f71",
});

export const paymentNote = style({
    margin: "0 0 12px",
    fontSize: 13,
    color: shop.muted,
});

export const applePayDetail = style({
    padding: "14px 16px 18px",
    background: shop.band,
    borderTop: `1px solid ${shop.border}`,
    fontSize: 13,
    color: shop.muted,
    textAlign: "center",
});

export const footerLinks = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    paddingTop: 20,
    borderTop: `1px solid ${shop.border}`,
    fontSize: 12,
    color: palette.accent,
    textDecoration: "underline",
    textUnderlineOffset: 3,
});
