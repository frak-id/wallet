import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const error = style({
    color: "#d32f2f",
    background: "#fff0f0",
    padding: "0.75rem 1rem",
    borderRadius: alias.cornerRadius.s,
    textAlign: "center",
});

export const link = style({
    display: "block",
    marginTop: "10px",
    color: "#d32f2f !important",
    textDecoration: "underline",
});

export const button = style({
    marginTop: "10px",
    backgroundColor: "rgb(48, 48, 48)",
    color: brand.colors.neutral.white,
});

export const title = style({
    marginBottom: "10px",
});
