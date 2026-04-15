import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const pushPasskey = style({
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: `1px solid ${vars.border.subtle}`,
});

export const buttonPush = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    margin: "0 auto",
});

export const statusSuccess = style({
    color: vars.text.success,
});

export const statusPending = style({
    color: vars.text.warning,
});

export const statusError = style({
    color: vars.text.error,
});

export const statusLink = style({
    color: vars.text.action,
    textDecoration: "underline",
});
