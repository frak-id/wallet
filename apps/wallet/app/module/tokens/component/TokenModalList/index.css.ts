import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const trigger = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    padding: `${alias.spacing.s} ${alias.spacing.s} ${alias.spacing.s} ${alias.spacing.s}`,
    borderRight: "1px solid var(--color-wallet-gray-mid)",
    fontWeight: "var(--brand-fontweight-bold)",
    cursor: "pointer",
    selectors: {
        "&::after": {
            content: "",
            width: 0,
            height: 0,
            borderStyle: "solid",
            borderWidth: "5px 4px 0 4px",
            borderColor:
                "var(--color-wallet-gray-mid) transparent transparent transparent",
            transform: "rotate(0deg)",
        },
    },
});
