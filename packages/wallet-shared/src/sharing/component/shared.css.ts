import { tablet } from "@frak-labs/design-system/breakpoints";
import { alias } from "@frak-labs/design-system/tokens";
import type { StyleRule } from "@vanilla-extract/css";

/**
 * Shared responsive container styles for tablet+.
 * Turns the full-viewport layout into a centered card.
 */
export const tabletContainerMedia: StyleRule["@media"] = {
    [`screen and (min-width: ${tablet}px)`]: {
        height: "auto",
        maxWidth: "560px",
        maxHeight: "90dvh",
        margin: "auto",
        borderRadius: alias.cornerRadius.xl,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
    },
};
