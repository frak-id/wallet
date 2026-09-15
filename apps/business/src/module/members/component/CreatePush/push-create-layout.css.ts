import { desktop, tablet } from "@frak-labs/design-system/breakpoints";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Form column + sticky phone column. The form defines the row height, so the
 * sticky preview stops at the form's bottom. Left inset matches the toolbar
 * gutter; the phone sits 40px from the right edge.
 */
export const row = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: alias.spacing.xl,
    paddingTop: alias.spacing.m,
    paddingLeft: alias.spacing.s,
    paddingRight: alias.spacing.s,
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            paddingLeft: alias.spacing.l,
            paddingRight: "40px",
        },
        [`screen and (width > ${desktop}px)`]: {
            paddingLeft: "126px",
        },
    },
});

// Basis 720, no grow: stays left while `space-between` pins the phone right.
export const formColumn = style({
    flex: "0 1 720px",
    minWidth: 0,
});
