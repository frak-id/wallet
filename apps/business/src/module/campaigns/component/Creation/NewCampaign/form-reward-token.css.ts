import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const tokenGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: alias.spacing.s,
    padding: alias.spacing.xxs,
    margin: `${alias.spacing.m} 0`,
    "@media": {
        "screen and (max-width: 768px)": {
            gridTemplateColumns: "repeat(2, 1fr)",
        },
        "screen and (max-width: 480px)": {
            gridTemplateColumns: "1fr",
        },
    },
});

export const tokenCard = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xs,
    padding: `20px ${alias.spacing.m}`,
    border: `2px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.background,
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "120px",
    selectors: {
        "&:hover": {
            borderColor: vars.border.focus,
            backgroundColor: vars.surface.muted,
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        },
    },
});

export const tokenCardSelected = style({
    borderColor: "#10b981", // TODO: token
    backgroundColor: "#f0fdf4", // TODO: token
    boxShadow: "0 0 0 2px #10b981",
});

export const selectedIndicator = style({
    position: "absolute",
    top: alias.spacing.xs,
    right: alias.spacing.xs,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#10b981", // TODO: token
});

export const tokenCardHeader = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
    width: "100%",
});

export const tokenName = style({
    fontSize: "16px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.primary,
    textAlign: "center",
});

export const tokenBadges = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
});

export const defaultTokenIcon = style({
    color: vars.text.secondary,
});

export const recommendedBadge = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#f59e0b", // TODO: token
});

export const tokenBalance = style({
    fontSize: "13px",
    color: vars.text.secondary,
    textAlign: "center",
});

globalStyle(`${tokenBalance} strong`, {
    color: vars.text.primary,
    fontWeight: brand.typography.fontWeight.semiBold,
});
