import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const panelDescription = style({
    fontSize: "14px",
    color: brand.colors.neutral.grey600,
    lineHeight: 1.5,
    marginBottom: alias.spacing.m,
});

export const distributionSlider = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: `${alias.spacing.xs} 0`,
});

export const distributionLabel = style({
    fontSize: "14px",
    color: brand.colors.neutral.grey600,
    minWidth: "60px",
    textAlign: "center",
});

export const distributionPercentage = style({
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: brand.colors.primary[600],
});

export const distributionPreview = style({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: alias.spacing.s,
});

export const distributionCard = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    padding: alias.spacing.m,
    background: brand.colors.neutral.grey50,
    border: `1px solid ${brand.colors.neutral.grey250}`,
    borderRadius: alias.cornerRadius.s,
});

export const distributionCardLabel = style({
    fontSize: "12px",
    color: brand.colors.neutral.grey600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
});

export const distributionCardAmount = style({
    fontSize: "20px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: brand.colors.neutral.grey800,
});

export const chainingTitle = style({
    fontSize: "16px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: brand.colors.neutral.grey800,
});

export const chainingInput = style({
    height: "40px",
    width: "100%",
    maxWidth: "120px",
    borderRadius: alias.cornerRadius.s,
    border: `1px solid ${brand.colors.neutral.grey250}`,
    padding: `0 ${alias.spacing.s}`,
    fontSize: "14px",
    background: "transparent",
    color: brand.colors.neutral.grey800,
    selectors: {
        "&:focus": {
            outline: "none",
            borderColor: brand.colors.primary[600],
        },
    },
});

export const chainingBarInfo = style({
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: brand.colors.neutral.grey600,
});

export const chainingBarTrack = style({
    height: "8px",
    background: brand.colors.neutral.grey200,
    borderRadius: alias.cornerRadius.xs,
    overflow: "hidden",
});

export const chainingBarFill = style({
    height: "100%",
    background: `linear-gradient(90deg, ${brand.colors.primary[600]}, ${brand.colors.primary[200]})`,
    borderRadius: alias.cornerRadius.xs,
    transition: "width 0.2s ease",
});

export const separator = style({
    height: "1px",
    background: brand.colors.neutral.grey250,
    margin: `${alias.spacing.xs} 0`,
});

export const triggerGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    marginTop: alias.spacing.xs,
});

export const triggerDisabled = style({
    opacity: 0.5,
    cursor: "not-allowed",
});
