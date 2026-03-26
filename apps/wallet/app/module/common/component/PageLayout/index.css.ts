import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    margin: `calc(-1 * ${alias.spacing.m})`,
    paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
    paddingBottom:
        "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
    background: vars.surface.background,
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
