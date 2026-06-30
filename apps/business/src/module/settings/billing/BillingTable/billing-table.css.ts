import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

/** Amount column reads with medium weight per Figma. */
export const amount = style({
    fontWeight: 500,
});

export const pdfButton = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    border: "none",
    background: "none",
    color: vars.text.primary,
    cursor: "pointer",
    flexShrink: 0,
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            color: vars.text.tertiary,
        },
    },
});
