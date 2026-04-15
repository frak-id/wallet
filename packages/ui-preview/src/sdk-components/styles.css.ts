import { keyframes, style } from "@vanilla-extract/css";

const fadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

// ─── Banner Preview ─────────────────────────────────────

export const bannerContainer = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
    animation: `${fadeIn} 300ms ease-out`,
    fontFamily: "system-ui, -apple-system, sans-serif",
});

export const bannerIconWrapper = style({
    flexShrink: 0,
    width: 40,
    height: 40,
    color: "#000000",
});

export const bannerBody = style({
    flex: 1,
    minWidth: 0,
});

export const bannerTitle = style({
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: "#1a1a1a",
    lineHeight: "22px",
});

export const bannerDescription = style({
    margin: "0 0 6px 0",
    fontSize: 12,
    color: "#979797",
    lineHeight: "22px",
});

export const bannerCta = style({
    display: "inline-block",
    padding: "4px 12px",
    border: "1px solid #000000",
    borderRadius: 9999,
    backgroundColor: "transparent",
    color: "#1a1a1a",
    fontSize: 10,
    fontWeight: 700,
    lineHeight: "12px",
    textTransform: "uppercase",
    cursor: "default",
});

// ─── Post-Purchase Preview ──────────────────────────────

export const postPurchaseCard = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    border: "1px solid #e0e0e0",
    fontFamily: "system-ui, -apple-system, sans-serif",
});

export const postPurchaseBody = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 8,
});

export const postPurchaseBadge = style({
    alignSelf: "flex-start",
    backgroundColor: "#FFF534",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: "12px",
    color: "#1a1a1a",
});

export const postPurchaseMessage = style({
    margin: 0,
    fontSize: 16,
    lineHeight: "22px",
    color: "#1a1a1a",
    fontWeight: 600,
});

export const postPurchaseCta = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 4,
    padding: "8px 16px",
    borderRadius: 9999,
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    border: "none",
    cursor: "default",
});

export const postPurchaseGiftIcon = style({
    flexShrink: 0,
    width: 80,
    height: 80,
    color: "#1a1a1a",
});

// ─── Share Button Preview ───────────────────────────────

export const shareButton = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 20px",
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    cursor: "default",
    fontFamily: "system-ui, -apple-system, sans-serif",
});
