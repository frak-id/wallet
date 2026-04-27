import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const successDialog = style({
    maxWidth: "343px",
    borderRadius: alias.cornerRadius.xl,
    padding: alias.spacing.m,
    backgroundColor: vars.surface.elevated,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xl,
});

/**
 * Reset the design-system `DialogTitle` chrome (fixed 18px/semiBold) and
 * center on the block `<h2>` itself — the inner `Text` is rendered as
 * `<span>` to avoid `<h2><h2/></h2>` nesting, and `text-align: center`
 * is a no-op on inline spans.
 */
export const successTitle = style({
    margin: 0,
    fontWeight: "inherit",
    fontSize: "inherit",
    color: "inherit",
    width: "100%",
    textAlign: "center",
});

/** Same reset as `successTitle`, for the `<p>` description slot. */
export const successDescription = style({
    margin: 0,
    fontSize: "inherit",
    lineHeight: "inherit",
    color: "inherit",
    width: "100%",
    textAlign: "center",
});
