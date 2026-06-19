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

export const accordionTransactions__container = style({
    marginTop: "8px",
    marginBottom: "8px",
});

/* Calldata code block: wrap (no horizontal scroll) + capped height with
 * vertical scroll for large payloads, matching MetaMask/Safe hex views. */
export const accordionTransactions__data = style({
    fontFamily: "monospace",
    fontSize: "12px",
    wordBreak: "break-all",
    maxHeight: "96px",
    overflowY: "auto",
    background: vars.surface.muted,
    borderRadius: alias.cornerRadius.s,
    padding: alias.spacing.s,
    color: vars.text.secondary,
});
