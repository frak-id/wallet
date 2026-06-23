import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const root = style({
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
    width: "100%",
});

/** Centered content area; the bottom bar sits below it. */
export const main = style({
    flexGrow: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: alias.spacing.l,
});

export const inner = style({
    width: "100%",
    maxWidth: "684px",
});

/** 48px light-blue disc holding the success check. */
export const checkCircle = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "48px",
    height: "48px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    color: vars.text.action,
});

/** 40px light-blue disc holding the notification bell, in a 44px-wide slot
 * (the extra 4px pushes the text block right of the disc). */
export const bellCircle = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "40px",
    height: "40px",
    marginRight: alias.spacing.xxs,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    color: vars.text.action,
});

/** Text column beside an icon: fills the row and lets long copy wrap. */
export const grow = style({
    flex: 1,
    minWidth: 0,
});

export const bottomBar = style({
    display: "flex",
    gap: alias.spacing.m,
    justifyContent: "center",
    padding: alias.spacing.l,
});
