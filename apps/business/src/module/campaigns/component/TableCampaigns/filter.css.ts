import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const filters = style({
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: alias.spacing.s,
    rowGap: alias.spacing.s,
    alignItems: "center",
});

export const filtersSearch = style({
    width: "300px",
});
