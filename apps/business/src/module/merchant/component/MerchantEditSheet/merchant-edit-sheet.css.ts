import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    padding: alias.spacing.l,
});

export const fieldCard = style({
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.m,
});

export const currencyGrid = style({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: `0 ${alias.spacing.m}`,
});

export const currencyCell = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: `${alias.spacing.m} 0`,
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
});

export const currencyIcon = style({
    display: "inline-flex",
    flexShrink: 0,
});

export const currencyMain = style({
    flex: 1,
    minWidth: 0,
});

export const currencyText = style({
    minWidth: 0,
});

export const infoBar = style({
    backgroundColor: vars.surface.secondary,
    borderRadius: alias.cornerRadius.m,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.l,
});

export const footerButton = style({
    flex: 1,
});
