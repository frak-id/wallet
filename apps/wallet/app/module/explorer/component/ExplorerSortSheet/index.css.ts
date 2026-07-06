import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** 40×4 drag knob. */
export const knobBar = style({
    display: "block",
    width: 40,
    height: 4,
    margin: `0 auto ${alias.spacing.m}`,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.border.default,
});

export const content = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const optionsCard = style({
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.l,
    width: "100%",
});

export const option = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
});

export const optionLabel = style({
    flex: 1,
    fontSize: fontSize.m,
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.primary,
    cursor: "pointer",
});

export const footer = style({
    marginTop: "auto",
    paddingTop: alias.spacing.l,
});
