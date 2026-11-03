import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const ticket = style({
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    padding: alias.spacing.l,
    borderRadius: alias.cornerRadius.xl,
    color: vars.text.onAction,
    background: `linear-gradient(145deg, ${brand.colors.primary[500]} 0%, ${brand.colors.primary[600]} 55%, ${brand.colors.primary[800]} 100%)`,
    boxShadow: "0 18px 40px -18px rgba(0, 67, 239, 0.6)",
});

export const glow = style({
    position: "absolute",
    top: -70,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: "50%",
    background:
        "radial-gradient(circle, rgba(255, 255, 255, 0.28), transparent 70%)",
    pointerEvents: "none",
});

export const label = style({
    fontSize: fontSize.s,
    fontWeight: 600,
    opacity: 0.92,
});

export const amount = style({
    fontSize: 56,
    lineHeight: 1,
    fontWeight: 700,
    letterSpacing: "-0.03em",
});

export const footer = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    paddingTop: alias.spacing.m,
    borderTop: "1.5px dashed rgba(255, 255, 255, 0.35)",
    fontSize: fontSize.xs,
    lineHeight: "18px",
    color: "rgba(255, 255, 255, 0.86)",
});

export const chip = style({
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    borderRadius: alias.cornerRadius.full,
    background: "rgba(255, 255, 255, 0.18)",
    color: vars.text.onAction,
    fontWeight: 600,
});
