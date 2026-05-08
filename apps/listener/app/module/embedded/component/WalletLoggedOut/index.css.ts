import { style } from "@vanilla-extract/css";

export const modalListenerWallet__text = style({
    marginBottom: "29px",
    fontSize: "21px",
    fontWeight: 600,
});

export const modalListenerWallet__buttonPrimary = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    border: "1px solid #ffffff",
    marginBottom: "10px",
    padding: "9px",
    borderRadius: "11px",
    cursor: "pointer",
    lineHeight: "24px",
    textAlign: "center",
    background: "var(--frak-header-background-color)",
    backdropFilter: "blur(13px)",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 600,
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.6,
        },
    },
});
