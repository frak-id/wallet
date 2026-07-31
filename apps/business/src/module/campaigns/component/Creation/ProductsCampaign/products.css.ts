import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Field + operator selects, side by side and equally wide. */
export const predicateRow = style({
    display: "flex",
    gap: alias.spacing.s,
    width: "100%",
    flexWrap: "wrap",
});

export const select = style({
    flex: 1,
    minWidth: 160,
});

/** A value row: input + its delete affordance. */
export const valueRow = style({
    display: "flex",
    gap: alias.spacing.s,
    alignItems: "center",
    width: "100%",
});

export const valueInput = style({
    flex: 1,
    minWidth: 0,
});

/** Read-only chips describing a scope the wizard can't edit. */
export const chipRow = style({
    display: "flex",
    flexWrap: "wrap",
    gap: alias.spacing.xs,
});
