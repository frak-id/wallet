import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    width: "100%",
});

export const cardWinner = style([
    card,
    {
        // Subtle border treatment to mark the winner without relying solely
        // on the variant — keeps colour-blind users informed.
        outline: `2px solid ${alias.primary.default}`,
        outlineOffset: -2,
    },
]);
