import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    // Fill the AppShell main flex column so siblings (e.g. inline toasts)
    // can claim their own height without forcing an overflow scrollbar.
    flex: "1 1 0",
    minHeight: 0,
    marginRight: `calc(-1 * ${alias.spacing.m})`,
    marginBottom: `calc(-1 * ${alias.spacing.m})`,
    marginLeft: `calc(-1 * ${alias.spacing.m})`,
    background: vars.surface.background,
    selectors: {
        // Bleed into main's top padding only when nothing is rendered above us.
        // When a sibling (toast, banner, ...) precedes PageLayout, we keep the
        // natural gap so the layouts don't overlap.
        "&:first-child": {
            marginTop: `calc(-1 * ${alias.spacing.m})`,
        },
    },
});

export const content = style({
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    paddingTop: alias.spacing.m,
    paddingBottom: alias.spacing.m,
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
});
