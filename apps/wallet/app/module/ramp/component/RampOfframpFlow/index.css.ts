import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const amountSection = style({
    paddingTop: "26px",
});

/** Width is set inline in `ch`: `field-sizing: content` is below the Safari 15.4 floor. */
export const amountInput = style({
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: vars.text.primary,
    fontSize: fontSize["5xl"],
    lineHeight: "1",
    fontWeight: 700,
    textAlign: "left",
    padding: 0,
    margin: 0,
    fontFamily: "inherit",
    fontVariantNumeric: "tabular-nums",
    caretColor: vars.text.action,
    "::placeholder": {
        color: vars.text.disabled,
    },
});

export const linkButton = style({
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
});

/** The SDK sizes its iframe to this node, so it needs a real height. */
export const widgetContainer = style({
    flexGrow: 1,
    width: "100%",
    minHeight: "min(640px, 75dvh)",
    borderRadius: alias.cornerRadius.l,
    overflow: "hidden",
    backgroundColor: vars.surface.background,
});
