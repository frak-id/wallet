import { vars } from "@frak-labs/design-system/theme";
import { brand, fontSize, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const pairingList = style({
    display: "flex",
    flexDirection: "column",
    gap: brand.scale[400],
});

export const pairingItem = style({
    borderRadius: brand.scale[200],
    padding: brand.scale[400],
    transition: `all ${transition.fast}`,
});

export const pairingHeader = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: brand.scale[400],
});

export const pairingId = style({
    fontSize: fontSize.s,
    color: vars.text.secondary,
});

export const pairingIcon = style({
    height: "1rem",
    width: "1rem",
});

export const pairingDetails = style({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: brand.scale[200],
    fontSize: fontSize.s,
});

export const pairingLabel = style({
    color: vars.text.secondary,
    display: "flex",
    alignItems: "center",
    gap: brand.scale[100],
});

export const pairingValue = style({
    fontWeight: brand.typography.fontWeight.medium,
});

export const pairingFooter = style({
    marginTop: brand.scale[400],
});

export const pairingDeleteButton = style({
    width: "100%",
    color: vars.text.error,
    transition: `color ${transition.slow}, background-color ${transition.slow}`,
});
