import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const error = style({
    color: brand.colors.error[600],
    background: brand.colors.error[50],
    padding: "0.75rem 1rem",
    borderRadius: alias.cornerRadius.s,
    textAlign: "center",
});

export const link = style({
    display: "block",
    marginTop: "10px",
    color: `${brand.colors.error[600]} !important`,
    textDecoration: "underline",
});

export const button = style({
    marginTop: "10px",
    backgroundColor: brand.colors.neutral.grey700,
    color: brand.colors.neutral.white,
});

export const title = style({
    marginBottom: "10px",
});
