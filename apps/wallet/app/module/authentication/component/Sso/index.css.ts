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

/** `nowrap` keeps the register-error pill on one line: `Notice` does not set
 * it, unlike the `Badge` surface it renders against. */
export const noticeSpacing = style({
    marginTop: alias.spacing.s,
    whiteSpace: "nowrap",
});
