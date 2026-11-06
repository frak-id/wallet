import { style } from "@vanilla-extract/css";
import { palette } from "./page.css";

/* Shopify checkout and order-status pages: white canvas, grey hairline boxes, brand ink. */

export const shop = {
    border: "#dedede",
    band: "#f5f5f5",
    muted: "#707070",
} as const;

export const canvas = style({ background: "#fff", color: "#1a1a1a" });

export const sectionTitle = style({
    margin: "0 0 12px",
    fontSize: 19,
    fontWeight: 600,
    letterSpacing: "-0.01em",
});

export const box = style({
    border: `1px solid ${shop.border}`,
    borderRadius: 6,
    background: "#fff",
});

export const lineThumb = style({
    position: "relative",
    flexShrink: 0,
    width: 60,
    height: 60,
    padding: 4,
    border: `1px solid ${shop.border}`,
    borderRadius: 8,
    background: palette.accentSoft,
});

export const qtyBadge = style({
    position: "absolute",
    top: -8,
    right: -8,
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 10,
    background: "rgba(26, 26, 26, 0.85)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: "20px",
    textAlign: "center",
});

export const orderLine = style({
    display: "flex",
    alignItems: "center",
    gap: 14,
    fontSize: 14,
});

export const orderLineText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
});

export const orderLineName = style({ fontWeight: 500 });

export const small = style({ fontSize: 12.5, color: shop.muted });

export const totals = style({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 14,
});

export const totalRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
});

export const grandTotal = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    fontSize: 18,
    fontWeight: 600,
});

export const currency = style({
    marginRight: 8,
    fontSize: 12,
    fontWeight: 400,
    color: shop.muted,
});
