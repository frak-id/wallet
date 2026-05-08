import { style } from "@vanilla-extract/css";

export const accordionTransactions__trigger = style({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: "var(--frak-accordion-trigger-color)",
    fontWeight: 400,
    fontSize: "14px",
});

export const accordionTransactions__content = style({
    overflow: "auto !important",
});

export const accordionTransactions__container = style({
    marginTop: "8px",
    marginBottom: "8px",
});

export const mobileTx__statusContainer = style({
    marginTop: "16px",
    textAlign: "center",
});

export const mobileTx__statusText = style({
    marginBottom: "8px",
    fontSize: "14px",
});

export const mobileTx__reopenLink = style({
    color: "var(--frak-color-accent)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
});

export const mobileTx__timeoutText = style({
    marginBottom: "16px",
    fontSize: "14px",
    color: "var(--frak-color-red)",
});

export const mobileTx__retryButton = style({
    display: "inline-block",
    padding: "12px 24px",
    backgroundColor: "transparent",
    color: "var(--frak-color-white, #fff)",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s ease",
    selectors: {
        "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.1)",
        },
    },
});

export const mobileTx__appNotFound = style({
    marginTop: "16px",
    padding: "16px",
    textAlign: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
});

export const mobileTx__appNotFoundText = style({
    marginBottom: "8px",
    fontSize: "16px",
    fontWeight: 500,
    color: "var(--frak-color-white, #fff)",
});

export const mobileTx__appNotFoundHint = style({
    marginBottom: "16px",
    fontSize: "14px",
    color: "var(--frak-color-grayText, #818c9c)",
});
