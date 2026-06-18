import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const accordionTransactions__trigger = style({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: vars.text.primary,
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
    color: vars.text.action,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
});

export const mobileTx__timeoutText = style({
    marginBottom: "16px",
    fontSize: "14px",
    color: vars.text.error,
});

export const mobileTx__retryButton = style({
    display: "inline-block",
    padding: "12px 24px",
    backgroundColor: "transparent",
    color: vars.text.action,
    borderRadius: alias.cornerRadius.xs,
    border: `1px solid ${vars.border.default}`,
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s ease",
    selectors: {
        "&:hover": {
            backgroundColor: vars.surface.muted,
        },
    },
});

export const mobileTx__appNotFound = style({
    marginTop: "16px",
    padding: "16px",
    textAlign: "center",
    backgroundColor: vars.surface.muted,
    border: `1px solid ${vars.border.subtle}`,
    borderRadius: alias.cornerRadius.xs,
});

export const mobileTx__appNotFoundText = style({
    marginBottom: "8px",
    fontSize: "16px",
    fontWeight: 500,
    color: vars.text.primary,
});

export const mobileTx__appNotFoundHint = style({
    marginBottom: "16px",
    fontSize: "14px",
    color: vars.text.secondary,
});
