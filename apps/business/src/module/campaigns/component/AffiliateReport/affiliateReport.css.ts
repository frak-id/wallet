import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const page = style({
    paddingBottom: "48px",
});

export const header = style({
    display: "flex",
    flexWrap: "wrap",
    gap: alias.spacing.m,
    justifyContent: "space-between",
    alignItems: "flex-start",
});

export const twoColumns = style({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: alias.spacing.m,
    "@media": {
        "screen and (max-width: 960px)": {
            gridTemplateColumns: "minmax(0, 1fr)",
        },
    },
});

export const chartBox = style({
    height: "200px",
});
