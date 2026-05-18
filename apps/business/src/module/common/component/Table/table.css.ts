import { brand } from "@frak-labs/design-system/tokens";
import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, style } from "@vanilla-extract/css";

export const tableWrapper = style({
    backgroundColor: vars.surface.elevated,
    borderRadius: "8px",
    overflowX: "auto",
    color: vars.text.secondary,
    border: `1px solid ${vars.border.default}`,
    boxShadow: "0 2px 2px 0 #1018281a",
});

export const table = style({
    width: "100%",
    borderCollapse: "collapse",
});

export const preTable = style({
    display: "flex",
    justifyContent: "flex-end",
    padding: "18px 24px",
});

export const tableButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    width: "100%",
    padding: "18px 22px",
    selectors: {
        "&:has(span)": { padding: 0 },
    },
});

globalStyle(`button${tableButton} > span`, {
    display: "inline-block",
    width: "100%",
    padding: "18px 22px",
});

export const tableFilterIcon = style({
    marginLeft: "auto",
    color: brand.colors.neutral.grey400,
});

globalStyle(`${table} > thead > tr > th`, {
    position: "relative",
    padding: "18px 22px",
    background: vars.surface.muted,
    textAlign: "left",
    whiteSpace: "nowrap",
    color: vars.text.primary,
    fontWeight: 500,
});

globalStyle(`${table} > thead > tr > th:has(button${tableButton})`, {
    padding: 0,
});

globalStyle(
    `${table} > tbody > tr > td, ${table} > tfoot > tr > th`,
    {
        padding: "18px 22px",
        textAlign: "left",
        borderTop: `1px solid ${vars.border.subtle}`,
        fontWeight: 500,
    }
);

globalStyle(`${table} a`, {
    color: "#0e51e3",
});
