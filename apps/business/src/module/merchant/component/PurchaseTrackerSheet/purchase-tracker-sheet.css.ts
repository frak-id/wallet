import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

/** Muted copy cell: label + truncated value + copy trigger. */
export const copyCell = style({
    minHeight: "49px",
    backgroundColor: vars.surface.muted,
    borderRadius: alias.cornerRadius.m,
});

export const copyCellLabel = style({
    flexShrink: 0,
    fontSize: fontSize.s,
    lineHeight: "22px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
});

export const copyCellValue = style({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: fontSize.xs,
    color: vars.text.primary,
    fontFamily: '"SF Mono", Menlo, Consolas, monospace',
});

export const instructions = style({
    margin: 0,
    fontSize: fontSize.s,
    lineHeight: "22px",
    color: vars.text.secondary,
});

globalStyle(`${instructions} a`, {
    color: vars.text.action,
    fontWeight: brand.typography.fontWeight.medium,
});
