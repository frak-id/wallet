import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const budgetRow = style({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: alias.spacing.xs,
});

export const budgetBarTrack = style({
    height: alias.size.xs,
    backgroundColor: vars.surface.disabled,
    borderRadius: alias.cornerRadius.full,
    overflow: "hidden",
});

export const budgetBarFill = style({
    height: "100%",
    backgroundColor: vars.surface.primary,
    borderRadius: alias.cornerRadius.full,
    transition: "width 200ms ease",
});

// Empty hook style — used only as a scope selector below so the
// last-column padding override doesn't leak into other tables.
export const campaignsTable = style({});

globalStyle(
    `${campaignsTable} > thead > tr > th:last-child, ${campaignsTable} > tbody > tr > td:last-child`,
    {
        paddingLeft: 0,
        paddingRight: alias.spacing.xs,
    }
);

export const rowMenuCell = style({
    display: "flex",
    justifyContent: "flex-end",
});
