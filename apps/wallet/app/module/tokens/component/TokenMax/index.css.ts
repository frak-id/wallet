import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const tokenMaxButton = style({
    margin: `0 0 -3px ${alias.spacing.s}`,
    padding: `${alias.spacing.s} ${alias.spacing.s}`,
    backgroundColor: "var(--frak-token-max-background-color)",
    border: "none",
    fontSize: fontSize.xs,
    cursor: "pointer",
    color: "var(--frak-token-max-color)",
});
