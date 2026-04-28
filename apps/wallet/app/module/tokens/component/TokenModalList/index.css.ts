import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Token-symbol button on the left of the amount input. Dropdown affordance
 * is a CSS-triangle rendered via `::after` borders.
 */
export const trigger = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    padding: alias.spacing.s,
    borderRight: `1px solid ${vars.border.default}`,
    fontWeight: brand.typography.fontWeight.bold,
    cursor: "pointer",
    selectors: {
        "&::after": {
            content: "",
            width: 0,
            height: 0,
            borderStyle: "solid",
            borderWidth: "5px 4px 0 4px",
            borderColor: `${vars.icon.secondary} transparent transparent transparent`,
        },
    },
});
