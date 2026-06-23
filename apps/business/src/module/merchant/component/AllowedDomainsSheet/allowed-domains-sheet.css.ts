import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const domainCard = style({
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.m,
});

export const domainList = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
});

export const domainItem = style({
    minHeight: "49px",
});

export const inputLabel = style({
    paddingInline: alias.spacing.m,
});

export const domainText = style({
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.s,
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});
