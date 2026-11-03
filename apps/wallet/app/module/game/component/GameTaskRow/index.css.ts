import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const row = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        gap: alias.spacing.s,
        padding: `${alias.spacing.s} ${alias.spacing.m}`,
        textDecoration: "none",
        color: "inherit",
        selectors: {
            "& + &": { borderTop: `1px solid ${vars.border.subtle}` },
        },
    },
    variants: {
        gate: { true: { background: brand.colors.primary[50] } },
        stacked: { true: { alignItems: "flex-start" } },
    },
});

export const text = style({ flex: 1, minWidth: 0 });

export const hint = style({ whiteSpace: "pre-line" });

export const reward = style({ flexShrink: 0, whiteSpace: "nowrap" });

export const rewardBelow = style({
    alignSelf: "flex-start",
    marginTop: alias.spacing.xxs,
    whiteSpace: "nowrap",
});
