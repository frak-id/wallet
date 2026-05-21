import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const rewardsEmpty = style({
    fontSize: "14px",
    color: brand.colors.neutral.grey600,
    fontStyle: "italic",
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    background: brand.colors.neutral.grey50,
    border: `1px solid ${brand.colors.neutral.grey250}`,
    borderRadius: alias.cornerRadius.s,
});

export const rewardsList = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});

export const rewardsItem = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    fontSize: "14px",
    color: brand.colors.neutral.grey700,
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    background: brand.colors.neutral.grey50,
    border: `1px solid ${brand.colors.neutral.grey250}`,
    borderRadius: alias.cornerRadius.s,
});

export const rewardsRecipient = style({
    fontWeight: brand.typography.fontWeight.medium,
    color: brand.colors.neutral.grey800,
});

export const rewardsSeparator = style({
    color: brand.colors.neutral.grey600,
});

export const rewardsAmount = style({
    fontWeight: brand.typography.fontWeight.semiBold,
    color: brand.colors.primary[600],
});

export const rewardsChaining = style({
    color: brand.colors.neutral.grey600,
    fontSize: "13px",
});

export const rewardsDetails = style({
    color: brand.colors.neutral.grey600,
    fontSize: "13px",
    fontWeight: brand.typography.fontWeight.regular,
});
