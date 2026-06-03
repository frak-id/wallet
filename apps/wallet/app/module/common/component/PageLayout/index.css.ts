import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    // Fills main's scroll area, negative margins bleed into main's padding.
    minHeight: `calc(100% + 2 * ${alias.spacing.m})`,
    marginRight: `calc(-1 * ${alias.spacing.m})`,
    marginBottom: `calc(-1 * ${alias.spacing.m})`,
    marginLeft: `calc(-1 * ${alias.spacing.m})`,
    background: vars.surface.background,
    selectors: {
        // Only bleed top when nothing precedes us.
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

// Onboarding bottom block: 24px top, 32px (or safe-area) bottom; above the fade.
export const footerFixed = style({
    position: "relative",
    zIndex: 1,
    paddingTop: alias.spacing.l,
    paddingBottom: `max(${alias.spacing.xl}, env(safe-area-inset-bottom))`,
});

// Reserve the footer's height (measured in PageLayout) so the last line clears it.
export const contentFixed = style({
    paddingBottom: "var(--footer-height, 0px)",
});

// Pin to the viewport bottom while content scrolls (sticks within AppShell's
// `mainContent`, the single scroller). Negative margin overlaps the reserved
// padding so content scrolls behind the footer.
export const footerSticky = style({
    position: "sticky",
    bottom: 0,
    marginTop: "calc(-1 * var(--footer-height, 0px))",
});

// White-wash fade so content dissolves (unreadable) behind the CTA. Avoids
// backdrop-filter: it whitens over the white bg on iOS and Chromium drops it
// under a mask — a wash renders identically on every engine.
export const footerBlur = style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
    background:
        "linear-gradient(to top, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.92) 45%, rgba(255, 255, 255, 0.6) 72%, rgba(255, 255, 255, 0) 100%)",
});
