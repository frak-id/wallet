import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Shared layout primitives for the authentication routes (SSO + login).
 * The choose view is vertically centered; the pairing view pins content
 * to the top so the QR code sits just under the page top.
 */

export const errorText = style({
    color: vars.text.error,
});

export const heroIcon = style({
    width: "48px",
    height: "48px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.surface.primary,
});

export const actions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
});

const contentBase = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    minHeight: 0,
    padding: `0 ${alias.spacing.m}`,
});

export const content = style([contentBase, { justifyContent: "center" }]);

export const contentTop = contentBase;
