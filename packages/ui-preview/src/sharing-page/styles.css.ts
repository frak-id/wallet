import { style } from "@vanilla-extract/css";

export const previewContainer = style({
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #e0e0e0",
    backgroundColor: "#ffffff",
});

export const header = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
});

export const headerLogo = style({
    fontSize: 11,
    fontWeight: 700,
    color: "#000000",
    letterSpacing: 1,
    textTransform: "uppercase",
});

export const dismissText = style({
    fontSize: 12,
    color: "#666666",
    fontWeight: 500,
});

export const rewardCard = style({
    margin: 16,
    padding: 20,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
    textAlign: "center",
    border: "1px solid #f5f5f5",
});

export const rewardTitle = style({
    fontSize: 16,
    fontWeight: 700,
    margin: "0 0 6px 0",
    color: "#000000",
    lineHeight: 1.3,
});

export const rewardTagline = style({
    fontSize: 12,
    color: "#666666",
    margin: 0,
    lineHeight: 1.4,
});

export const footer = style({
    display: "flex",
    gap: 8,
    padding: "12px 16px",
    borderTop: "1px solid #f0f0f0",
});

export const confirmationFooter = style({
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "12px 16px",
    borderTop: "1px solid #f0f0f0",
});

const sharedButton = style({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    border: "none",
    cursor: "default",
});

export const shareButton = style([
    sharedButton,
    {
        backgroundColor: "#000000",
        color: "#ffffff",
    },
]);

export const copyButton = style([
    sharedButton,
    {
        backgroundColor: "#f5f5f5",
        color: "#000000",
    },
]);

export const heroSection = style({
    padding: "32px 16px",
    textAlign: "center",
});

export const heroTitle = style({
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: "#000000",
    lineHeight: 1.3,
});

export const ctaButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: "#000000",
    color: "#ffffff",
    border: "none",
    cursor: "default",
});

export const shareAgainButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    color: "#666666",
    fontSize: 12,
    fontWeight: 500,
});
