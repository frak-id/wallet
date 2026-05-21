import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, keyframes, style } from "@vanilla-extract/css";

const scaleIn = keyframes({
    "0%": { transform: "scale(0)", opacity: 0 },
    "50%": { transform: "scale(1.1)" },
    "100%": { transform: "scale(1)", opacity: 1 },
});

const pulse = keyframes({
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.7 },
});

export const currencyGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: alias.spacing.s,
    padding: alias.spacing.xxs,
    "@media": {
        "(max-width: 768px)": {
            gridTemplateColumns: "repeat(2, 1fr)",
        },
        "(max-width: 480px)": {
            gridTemplateColumns: "1fr",
        },
    },
});

export const currencyCard = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: `20px ${alias.spacing.m}`,
    border: `2px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.elevated,
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "100px",
});

export const currencyCardSelected = style({
    borderColor: vars.border.success,
    backgroundColor: vars.surface.success,
    boxShadow: `0 0 0 2px ${vars.border.success}`,
});

export const currencyCardDisabled = style({
    cursor: "not-allowed",
    opacity: 0.5,
});

globalStyle(`${currencyCard}:hover:not(${currencyCardDisabled})`, {
    borderColor: brand.colors.primary[500],
    backgroundColor: vars.surface.muted,
    transform: "translateY(-2px)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
});

export const currencySymbol = style({
    fontSize: "24px",
    fontWeight: brand.typography.fontWeight.bold,
    color: vars.text.primary,
    letterSpacing: "-0.5px",
});

export const currencyBadges = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
});

export const selectedIndicator = style({
    position: "absolute",
    top: alias.spacing.xs,
    right: alias.spacing.xs,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.success,
    animation: `${scaleIn} 0.2s ease-out`,
});

export const recommendedBadge = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.warning,
    animation: `${pulse} 2s ease-in-out infinite`,
});

export const currencyExplanation = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.surface.muted,
    border: `1px solid ${vars.border.default}`,
});

export const explanationSection = style({
    fontSize: "14px",
    lineHeight: 1.5,
    color: vars.text.secondary,
});

globalStyle(`${explanationSection} strong`, {
    color: vars.text.primary,
    fontWeight: brand.typography.fontWeight.semiBold,
});
