import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Vertical list of goal option rows inside the card (rows are flush; their
 * own 16px padding provides the spacing). */
export const list = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.none,
});

/** A single selectable goal row (radio + icon badge + text) — no chrome; the
 * filled radio is the only selection cue. The radio + badge pair is
 * top-aligned to the text block. */
export const row = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
    width: "100%",
    padding: alias.spacing.m,
    cursor: "pointer",
    textAlign: "left",
});

/** Radio + badge group: centered to each other (radio sits at the badge's
 * vertical centre) and nudged 2px down to align with the text block. */
export const left = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "center",
    flexShrink: 0,
    paddingTop: 2,
    paddingBottom: 2,
});

/** 40px light-blue circle holding the (blue) goal icon, in a 44px-wide slot
 * (the extra 4px pushes the text block right of the avatar). */
export const badge = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 40,
    height: 40,
    marginRight: alias.spacing.xxs,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    color: vars.text.action,
});

export const main = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    minWidth: 0,
});

/** Description + tags sit directly under each other (no gap). */
export const textGroup = style({
    display: "flex",
    flexDirection: "column",
});
