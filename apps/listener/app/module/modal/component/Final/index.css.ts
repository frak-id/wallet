import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Push the "copied" confirmation pill down from the modal's top edge. */
export const copiedToast = style({
    marginTop: alias.spacing.m,
});
