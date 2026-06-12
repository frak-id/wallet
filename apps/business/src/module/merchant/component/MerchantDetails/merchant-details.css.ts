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

/**
 * The form column ends at 846px (126px gutter + 720px max-width); the phone
 * needs 353px + 40px right offset + 24px gap → fits from 1264px up. The
 * height guard keeps the 735px-tall phone from overlapping the sticky
 * toolbar and the floating save bar on short windows.
 */
export const phonePreviewFixed = style({
    "@media": {
        "(min-width: 1264px) and (min-height: 820px)": {
            position: "fixed",
            right: "40px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 11,
        },
        "(max-width: 1263px), (max-height: 819px)": {
            display: "none",
        },
    },
});
