import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, easing, transition } from "../../tokens.css";

export const radioGroup = style({
    display: "flex",
    flexDirection: "column",
});

/**
 * 20px ring radio: 2px border, grey (`border.default`) when off → blue
 * (`surface.primary`) when checked.
 * The 11px center dot is the radix Indicator itself (only mounted when
 * checked), so no pseudo-element / globalStyle is needed.
 */
export const radioGroupItem = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "20px",
    height: "20px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.background,
    border: `2px solid ${vars.border.default}`,
    cursor: "pointer",
    transition: `all ${transition.base} ${easing.default}`,

    ":focus-visible": {
        boxShadow: `0 0 0 2px ${vars.border.focus}`,
    },

    selectors: {
        '&[data-state="checked"]': {
            borderColor: vars.surface.primary,
        },
        "&[data-disabled]": {
            opacity: 0.5,
            cursor: "not-allowed",
        },
    },
});

/**
 * Blue center dot. The source glyph is r≈5.46 (≈10.92px); we use an even 10px so it
 * stays integer-centered inside the 16px content box (3px gap each side) and
 * never lands on a half-pixel — odd sizes round asymmetrically at 1x and
 * read as off-centre.
 */
export const radioGroupIndicator = style({
    width: "10px",
    height: "10px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.primary,
});

/**
 * 24px variant — used by the campaign wizard. The ring stays 20px; a 2px
 * halo brings the layout box to 24×24 (the design component's geometry).
 */
export const radioGroupItemLarge = style({
    margin: "2px",
});
