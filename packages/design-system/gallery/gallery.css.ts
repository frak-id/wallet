import { tablet } from "@frak-labs/design-system/breakpoints";
import { globalStyle, style } from "@vanilla-extract/css";

// The app reset locks the body (`overflow: hidden`, centred on tablet+);
// a page of stacked sections has to scroll and start at the top.
globalStyle("body", {
    overflow: "auto",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            display: "block",
            minHeight: "unset",
        },
    },
});

export const page = style({
    maxWidth: "960px",
    marginInline: "auto",
    padding: "16px",
});

/** Same height the business overview cards give their charts. */
export const chartBox = style({
    height: "180px",
});

export const chartBoxTall = style({
    height: "200px",
});
