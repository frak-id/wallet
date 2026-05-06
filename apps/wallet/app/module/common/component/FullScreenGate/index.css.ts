import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Full-bleed blocking surface. Padding folds in the safe-area insets so the
 * action stays clear of the home indicator on iOS and the status bar on
 * Android without callers having to know about it.
 */
export const gate = style({
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    backgroundColor: vars.surface.background2,
    paddingLeft: alias.spacing.l,
    paddingRight: alias.spacing.l,
    paddingTop: `calc(env(safe-area-inset-top, 0px) + ${alias.spacing.l})`,
    paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${alias.spacing.l})`,
});

export const content = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: alias.spacing.m,
    width: "100%",
    textAlign: "center",
});

export const description = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    color: vars.text.secondary,
    textAlign: "center",
    maxWidth: "320px",
});

export const actions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
});
