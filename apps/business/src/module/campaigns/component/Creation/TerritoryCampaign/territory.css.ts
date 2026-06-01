import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Vertical list of special-category rows (flush; their padding spaces them). */
export const cells = style({
    display: "flex",
    flexDirection: "column",
    width: "100%",
});

/** A special-category row: checkbox + title/description. */
export const categoryRow = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
    width: "100%",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
    textAlign: "left",
});

/** Checkbox centred in a 40px band, nudged 2px down (matches the design). */
export const categorySelector = style({
    display: "flex",
    alignItems: "center",
    height: 40,
    flexShrink: 0,
    marginTop: 2,
});

export const categoryMain = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    flex: 1,
    minWidth: 0,
});
