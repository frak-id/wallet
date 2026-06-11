import { vars } from "@frak-labs/design-system/theme";
import { base, element } from "@frak-labs/design-system/utils";
import { style } from "@vanilla-extract/css";

export const iconButton = style([
    base,
    element.button,
    {
        // inline-flex so the td's text-align: right positions the icon
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
        color: vars.icon.secondary,
        selectors: {
            "&:disabled": {
                cursor: "default",
            },
        },
    },
]);

// opacity dims the whole row subtree, no descendant selector needed
export const rowStaged = style({
    opacity: 0.5,
});
