import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const filters = style({
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: alias.spacing.s,
    rowGap: alias.spacing.s,
    marginBottom: alias.spacing.m,
    alignItems: "center",
});

export const filtersSearch = style({
    width: "300px",
});

export const filtersDatePickerTrigger = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});
