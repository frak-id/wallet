import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const root = style({
    display: "flex",
    alignItems: "stretch",
    width: "100%",
    // Fill the viewport below the fixed 70px header so the rail spans full height.
    minHeight: "calc(100dvh - 70px)",
    backgroundColor: vars.surface.background2,
    // Cancel the shell's breathing padding (`<main>` = offset + 24px on every
    // side) so the wizard renders flush against the nav + header. Subtracting the
    // breathing value leaves exactly the fixed nav/header offsets intact.
    margin: `calc(-1 * ${alias.spacing.l})`,
    "@media": {
        "(max-width: 900px)": {
            flexDirection: "column",
        },
        "(max-width: 768px)": {
            margin: `calc(-1 * ${alias.spacing.s})`,
        },
    },
});

export const rail = style({
    flexShrink: 0,
    width: 360,
    backgroundColor: vars.surface.background,
    borderRight: `1px solid ${vars.border.subtle}`,
    padding: alias.spacing.l,
    paddingTop: alias.spacing.xxl,
    "@media": {
        "(max-width: 900px)": {
            width: "100%",
            borderRight: "none",
            borderBottom: `1px solid ${vars.border.subtle}`,
            paddingTop: alias.spacing.l,
        },
    },
});

export const main = style({
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
});

/** Header padding: top 24, sides 24, no bottom (content's 24 top spaces the first card). */
export const header = style({
    paddingTop: alias.spacing.l,
    paddingRight: alias.spacing.l,
    paddingBottom: 0,
    paddingLeft: alias.spacing.l,
});

export const content = style({
    flex: 1,
    padding: alias.spacing.l,
    // The form column is capped at 704px (680px cards + the 24px left inset).
    maxWidth: 728,
});

export const footer = style({
    position: "sticky",
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: alias.spacing.s,
    padding: `${alias.spacing.l} ${alias.spacing.xxl}`,
    background: `linear-gradient(to top, ${vars.surface.background2} 60%, transparent)`,
    "@media": {
        "(max-width: 900px)": {
            padding: alias.spacing.l,
        },
    },
});
