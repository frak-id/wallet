import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Row primitives shared by the wizard's selectable-option steps. The same
 * three shapes are also hand-rolled in `territory.css.ts` and `reward.css.ts`;
 * new steps build on these so the copies stop multiplying.
 */

/** Vertical list of option rows (flush; the rows' own padding spaces them). */
export const optionList = style({
    display: "flex",
    flexDirection: "column",
    width: "100%",
});

/** An option row: selector (radio/checkbox) then title/description. */
export const optionRow = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
    width: "100%",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
    textAlign: "left",
});

/** The title/description column of an option row. */
export const optionMain = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    flex: 1,
    minWidth: 0,
});

/** Bare icon button for a row-level action (remove a row). */
export const rowIconButton = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    color: vars.icon.secondary,
});
