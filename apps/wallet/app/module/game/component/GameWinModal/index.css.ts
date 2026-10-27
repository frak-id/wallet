import { vars } from "@frak-labs/design-system/theme";
import { alias, safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const screen = style({
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: vars.surface.background2,
    paddingLeft: alias.spacing.l,
    paddingRight: alias.spacing.l,
    paddingTop: `calc(${safeArea.top} + ${alias.spacing.l})`,
    paddingBottom: `calc(${safeArea.bottom} + ${alias.spacing.l})`,
    "@media": {
        // The overlay turns into a centred card there.
        "screen and (min-width: 1024px)": { minHeight: 480 },
    },
});

export const body = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.m,
    textAlign: "center",
});

export const actions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    width: "100%",
});
