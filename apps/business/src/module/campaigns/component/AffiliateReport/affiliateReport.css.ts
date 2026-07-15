import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
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

export const amount = style({
    fontSize: "28px",
    lineHeight: "32px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.primary,
    fontVariantNumeric: "tabular-nums",
});

export const truncatedBanner = style({
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.warning,
    color: vars.text.warning,
    fontSize: "13px",
});

export const breakdownRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingBlock: alias.spacing.xxs,
});

export const table = style({
    width: "100%",
    borderCollapse: "collapse",
    fontVariantNumeric: "tabular-nums",
});

export const cell = style({
    textAlign: "right",
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    borderTop: `1px solid ${vars.border.subtle}`,
});

export const cellHead = style([
    cell,
    {
        borderTop: "none",
        color: vars.text.secondary,
        fontWeight: brand.typography.fontWeight.medium,
    },
]);

export const cellStart = style({
    textAlign: "left",
});
