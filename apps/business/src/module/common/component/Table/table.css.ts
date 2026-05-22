import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const tableWrapper = style({
    overflowX: "auto",
    color: vars.text.secondary,
    backgroundColor: vars.surface.elevated,
    border: `1px solid ${vars.border.subtle}`,
    borderRadius: alias.cornerRadius.s,
});

export const table = style({
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
});

export const preTable = style({
    display: "flex",
    justifyContent: "flex-end",
    padding: `${alias.spacing.m} ${alias.spacing.s}`,
});

export const tableButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    cursor: "pointer",
    width: "100%",
    height: "100%",
});

export const tableFilterIcon = style({
    color: vars.icon.secondary,
    width: "16px",
    height: "16px",
    transition: "transform 0.15s ease",
});

export const tableFilterIconDesc = style({
    transform: "rotate(180deg)",
});

globalStyle(`${table} > thead > tr > th`, {
    position: "relative",
    height: "48px",
    padding: `0 ${alias.spacing.s}`,
    background: vars.surface.muted,
    textAlign: "left",
    whiteSpace: "nowrap",
    color: vars.text.secondary,
    fontWeight: brand.typography.fontWeight.medium,
    lineHeight: "22px",
    boxShadow: `inset 0 -1px 0 0 ${vars.border.subtle}`,
});

globalStyle(`${table} > tbody > tr > td`, {
    height: "56px",
    padding: `0 ${alias.spacing.s}`,
    textAlign: "left",
    color: vars.text.primary,
    fontWeight: brand.typography.fontWeight.regular,
    lineHeight: "22px",
    boxShadow: `inset 0 -1px 0 0 ${vars.border.subtle}`,
});

globalStyle(`${table} > tfoot > tr > th`, {
    height: "56px",
    padding: `0 ${alias.spacing.s}`,
    textAlign: "left",
    color: vars.text.primary,
    fontWeight: brand.typography.fontWeight.medium,
    lineHeight: "22px",
    boxShadow: `inset 0 1px 0 0 ${vars.border.subtle}`,
});

globalStyle(`${table} > tbody > tr:last-child > td`, {
    boxShadow: "none",
});

globalStyle(`${table} a`, {
    color: vars.text.action,
});

globalStyle(`${table} > tbody > tr[data-clickable="true"]`, {
    cursor: "pointer",
});

globalStyle(`${table} > tbody > tr[data-clickable="true"]:hover`, {
    backgroundColor: vars.surface.muted,
});
