import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const root = style({
    display: "flex",
    alignItems: "stretch",
    width: "100%",
    minHeight: "100dvh",
    backgroundColor: vars.surface.background2,
    "@media": {
        "(max-width: 900px)": {
            flexDirection: "column",
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

/** Header padding: top 24, sides 24, small bottom (content's 24 top spaces the first card). */
export const header = style({
    position: "sticky",
    top: 0,
    zIndex: 10,
    paddingTop: alias.spacing.l,
    paddingRight: alias.spacing.l,
    paddingBottom: alias.spacing.xs,
    paddingLeft: alias.spacing.l,
    backdropFilter: "blur(5px)",
    WebkitBackdropFilter: "blur(5px)",
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
