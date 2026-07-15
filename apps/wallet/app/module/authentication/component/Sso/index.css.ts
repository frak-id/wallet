import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const successIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.text.success,
});

export const merchantImg = style({
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

export const merchantLink = style({
    color: vars.text.action,
    textDecoration: "underline",
});

export const disclaimerLink = style({
    color: vars.text.action,
    textDecoration: "none",
});

/** Preserves the local `Notice`'s original `marginTop` above the register error. */
// The old local `Notice` rendered inside `Badge`, whose base set
// `white-space: nowrap` (inherited by the caption text). `Notice` doesn't,
// so restore it to keep the pill 1:1. No `font-weight` here: the old caption
// `Text` set an explicit `regular` weight on the span, beating Badge's 600.
export const noticeSpacing = style({
    marginTop: alias.spacing.s,
    whiteSpace: "nowrap",
});
