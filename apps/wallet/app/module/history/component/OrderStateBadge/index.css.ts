import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { recipe } from "@vanilla-extract/recipes";

export const badge = recipe({
    base: {
        position: "absolute",
        borderRadius: alias.cornerRadius.full,
        background: vars.surface.background,
    },
    variants: {
        size: {
            s: { bottom: -5, right: -5, width: 20, height: 20, padding: 2 },
            m: { bottom: -6, right: -6, width: 26, height: 26, padding: 3 },
        },
    },
    defaultVariants: { size: "s" },
});

export const badgeInner = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: alias.cornerRadius.full,
    },
    variants: {
        status: {
            pending: { background: vars.icon.warning },
            rejected: { background: vars.icon.error },
        },
    },
});
