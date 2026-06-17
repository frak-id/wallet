import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const textareaMuted = style({
    backgroundColor: vars.surface.muted,
    borderRadius: alias.cornerRadius.m,
    width: "100%",
    paddingBlock: alias.spacing.xs,
    selectors: {
        "&&": {
            border: "none",
            boxShadow: "none",
        },
        // No focus ring, matching the DS `bare` inputs around it.
        "&&:focus-within": {
            boxShadow: "none",
            outline: "none",
        },
    },
});

export const switchRow = style({
    borderRadius: alias.cornerRadius.l,
    backgroundColor: vars.surface.elevated,
});
