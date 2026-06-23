import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const header = style({
    position: "sticky",
    top: 0,
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    paddingBottom: alias.spacing.xs,
    backdropFilter: "blur(5px)",
    WebkitBackdropFilter: "blur(5px)",
});

export const title = style({
    margin: 0,
    fontSize: fontSize["3xl"],
    lineHeight: "38px",
    fontWeight: brand.typography.fontWeight.bold,
    color: vars.text.primary,
});

export const description = style({
    margin: 0,
    fontSize: fontSize.m,
    lineHeight: "26px",
    color: vars.text.secondary,
});

export const cell = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: alias.spacing.m,
    backgroundColor: vars.surface.background,
    paddingInline: alias.spacing.m,
    paddingBlock: alias.spacing.s,
});

export const infoIcon = style({
    color: vars.text.secondary,
    flexShrink: 0,
});

export const amount = style({
    fontSize: fontSize["4xl"],
    lineHeight: "40px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.primary,
});

export const actionsRow = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: alias.spacing.xs,
    borderTop: `1px solid ${vars.border.subtle}`,
    marginTop: alias.spacing.xxs,
    paddingTop: alias.spacing.s,
});

export const warningChip = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    color: vars.text.warning,
    backgroundColor: vars.surface.warning,
    borderRadius: alias.cornerRadius.s,
    paddingInline: alias.spacing.xs,
    paddingBlock: alias.spacing.xxs,
    fontSize: fontSize.xs,
});

export const inlineInput = style({
    width: "120px",
    height: "36px",
});

export const emptyCard = style({
    flex: 1,
    minWidth: 0,
});

export const balanceRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: alias.spacing.m,
    height: "49px",
    paddingInline: alias.spacing.m,
});

export const flexButton = style({
    flex: 1,
});

export const centered = style({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: alias.spacing.xl,
});

export const errorText = style({
    color: vars.text.error,
    textAlign: "center",
    padding: alias.spacing.l,
});
