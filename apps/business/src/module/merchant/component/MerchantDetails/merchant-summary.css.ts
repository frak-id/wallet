import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const summaryRow = style({
    display: "flex",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    fontSize: "14px",
});

export const summaryLabel = style({
    color: vars.text.secondary,
});

export const summaryValue = style({
    color: vars.text.primary,
    fontWeight: 500,
});

export const providerBadge = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${alias.spacing.xxs} ${alias.spacing.xs}`,
    backgroundColor: vars.surface.muted,
    color: vars.text.secondary,
    borderRadius: alias.cornerRadius.s,
    fontSize: "12px",
    marginLeft: alias.spacing.xs,
});

export const domainTagList = style({
    display: "flex",
    flexWrap: "wrap",
    gap: alias.spacing.xs,
});

export const domainTag = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${alias.spacing.xxs} ${alias.spacing.xs}`,
    backgroundColor: vars.surface.muted,
    color: vars.text.primary,
    borderRadius: alias.cornerRadius.s,
    fontSize: "13px",
});

export const summaryActions = style({
    display: "flex",
    justifyContent: "flex-end",
    marginTop: alias.spacing.s,
});

export const summaryDescription = style({
    color: vars.text.tertiary,
    fontSize: "13px",
    fontStyle: "italic",
});
