import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// Success screen only — input + banner + error styles live in
// `EmailFormScreen` and are reused across this page and onboarding.

export const body = style({
    paddingInline: alias.spacing.m,
    marginTop: alias.spacing.m,
});

export const successActions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    width: "100%",
});
