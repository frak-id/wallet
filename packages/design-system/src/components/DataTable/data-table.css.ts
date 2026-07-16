import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, brand, easing, fontSize, transition } from "../../tokens.css";
import { wrapperBorder } from "../Table/table.css";

export const tableWrapper = style([
    wrapperBorder,
    {
        overflowX: "auto",
        color: vars.text.secondary,
        backgroundColor: vars.surface.elevated,
    },
]);

export const table = style({
    width: "100%",
    borderCollapse: "collapse",
    fontSize: fontSize.s,
});

/**
 * Opt-in `table-layout: fixed`: column widths come from `size` (not content),
 * so cells with `overflow: hidden` truncate to their computed width and
 * unsized columns share the remaining space.
 */
export const tableFixedLayout = style({
    tableLayout: "fixed",
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

export const tableButtonEnd = style({
    justifyContent: "space-between",
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

/**
 * Base header/cell look (48px header, 56px rows, padding, weights,
 * line-height, dividers, surfaces) comes from the `Table` primitive's
 * `headerCell`/`cell` recipe classes, applied to the rendered cells. Only
 * the header props with no recipe equivalent live here.
 */
globalStyle(`${table} > thead > tr > th`, {
    position: "relative",
    whiteSpace: "nowrap",
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
    transition: `background-color ${transition.fast} ${easing.default}`,
});

globalStyle(`${table} > tbody > tr[data-clickable="true"]:hover > td`, {
    backgroundColor: vars.surface.muted,
});

globalStyle(`${table} > tbody > tr[data-selected="true"] > td`, {
    backgroundColor: vars.surface.secondary,
});

globalStyle(
    `${table}[data-any-selected="true"] > tbody > tr:not([data-selected="true"]) > td`,
    {
        opacity: 0.5,
    }
);
