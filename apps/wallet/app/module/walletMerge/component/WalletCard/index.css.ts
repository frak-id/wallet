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

export const header = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
});

export const statRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
});
