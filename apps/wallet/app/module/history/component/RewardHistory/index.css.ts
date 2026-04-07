import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

export const emptyLayout = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: alias.spacing.m,
});

export const merchantLogo = style({
    position: "relative",
    marginTop: 2,
    marginRight: 5,
    width: 40,
    height: 40,
    borderRadius: alias.cornerRadius.full,
    border: `1px solid ${vars.border.default}`,
    flexShrink: 0,
});

export const merchantLogoImg = style({
    width: "100%",
    height: "100%",
    borderRadius: "inherit",
    objectFit: "cover",
});

export const merchantLogoFallback = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    fontSize: 23,
    letterSpacing: "-0.15em",
    fontWeight: 600,
    color: vars.text.primary,
});

export const statusText = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const itemInfo = style({
    minWidth: 0,
});

export const badge = style({
    position: "absolute",
    bottom: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: alias.cornerRadius.full,
    padding: 2,
    background: vars.surface.background,
});

const badgeInnerBase = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: alias.cornerRadius.full,
});

export const badgeInner = styleVariants({
    pending: [badgeInnerBase, { background: vars.icon.warning }],
    settled: [badgeInnerBase, { background: vars.icon.secondary }],
});
