import { vars } from "@frak-labs/design-system/theme";
import { brand, fontSize, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const signatureRequest = style({});

export const signatureRequestDescription = style({
    margin: `${brand.scale[300]} 0 ${brand.scale[300]} 0`,
});

export const signatureRequestFrom = style({
    backgroundColor: vars.surface.elevated,
    borderRadius: brand.scale[100],
    padding: `${brand.scale[50]} ${brand.scale[100]}`,
    color: vars.text.primary,
    border: `1px solid ${vars.border.default}`,
});

export const signatureRequestButtons = style({
    display: "flex",
    gap: brand.scale[300],
    justifyContent: "center",
    margin: `${brand.scale[300]} 0`,
});

export const signatureRequestState = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: brand.scale[200],
    backgroundColor: vars.surface.muted,
    borderRadius: brand.scale[200],
    fontSize: fontSize.xs,
    fontWeight: brand.typography.fontWeight.medium,
});

export const signatureRequestStateLabel = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[100],
});

export const stateLabelError = style({
    display: "flex",
    color: vars.text.error,
});

export const stateLabelSuccess = style({
    color: vars.text.success,
});

export const dangerButton = style({
    color: vars.text.error,
    borderColor: vars.border.error,
    transition: `all ${transition.fast}`,
});
