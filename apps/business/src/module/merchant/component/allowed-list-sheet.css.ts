import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Shared chrome for the sheets that manage a merchant allow-list (domains,
 * app package ids): a card wrapping a list of removable entries, plus the
 * add-entry form below it.
 */
export const card = style({
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.m,
});

export const list = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
});

export const item = style({
    minHeight: "49px",
});

export const inputLabel = style({
    paddingInline: alias.spacing.m,
});

export const itemText = style({
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.s,
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});
