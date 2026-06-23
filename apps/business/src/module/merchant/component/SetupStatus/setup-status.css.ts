import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const stepItem = style({
    padding: alias.spacing.m,
    borderLeft: `${brand.scale[100]} solid ${brand.colors.neutral.grey250}`,
    marginBottom: alias.spacing.l,
    position: "relative",
    width: "100%",
});

export const header = style({
    display: "flex",
    alignItems: "center",
    marginBottom: alias.spacing.xs,
});

export const stepPosition = style({
    color: brand.colors.neutral.grey700,
    width: brand.scale[600],
    height: brand.scale[600],
    borderColor: brand.colors.neutral.grey700,
    borderRadius: "50%",
    borderStyle: "solid",
    borderWidth: brand.scale[50],
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: fontSize.s,
    fontWeight: brand.typography.fontWeight.bold,
    marginRight: alias.spacing.s,
    flexShrink: 0,
});

export const stepName = style({
    fontSize: fontSize.l,
    fontWeight: brand.typography.fontWeight.medium,
    display: "flex",
    alignItems: "center",
    color: brand.colors.neutral.grey700,
});

export const icon = style({
    color: brand.colors.success[600],
    marginLeft: alias.spacing.xs,
    flexShrink: 0,
});

export const iconWarning = style({
    color: brand.colors.warning[600],
    marginLeft: alias.spacing.xs,
    flexShrink: 0,
});

export const description = style({
    margin: `${alias.spacing.xs} 0 ${alias.spacing.xs} ${brand.scale[900]}`,
    color: brand.colors.neutral.grey700,
    fontSize: fontSize.s,
    lineHeight: 1.5,
});

export const actions = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: alias.spacing.m,
    marginLeft: brand.scale[900],
    gap: alias.spacing.m,
});
