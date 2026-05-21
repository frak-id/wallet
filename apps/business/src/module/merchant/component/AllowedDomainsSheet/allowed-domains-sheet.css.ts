import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const description = style({
    margin: 0,
    fontSize: "14px",
    color: vars.text.secondary,
});

export const domainList = style({
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const domainItem = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    border: `1px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.s,
    fontSize: "14px",
    color: vars.text.primary,
});

export const error = style({
    margin: `${alias.spacing.xxs} 0 0`,
    fontSize: "12px",
    color: vars.text.error,
});

export const emptyState = style({
    color: vars.text.tertiary,
    fontSize: "14px",
    fontStyle: "italic",
});
