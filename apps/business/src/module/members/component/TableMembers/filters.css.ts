import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const filters = style({
    display: "flex",
    alignItems: "center",
    marginBottom: "10px",
    gap: alias.spacing.m,
});

export const filtersItem = style({
    display: "flex",
    gap: alias.spacing.m,
    flex: 1,
    selectors: {
        "&:last-child": {
            justifyContent: "flex-end",
        },
    },
});

export const filtersPopoverContent = style({
    padding: alias.spacing.m,
});
