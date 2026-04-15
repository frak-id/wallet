import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, fontSize as fs } from "../../tokens.css";

const easing = "cubic-bezier(0.87, 0, 0.13, 1)";

const slideDown = keyframes({
    from: { height: "0" },
    to: { height: "var(--radix-accordion-content-height)" },
});

const slideUp = keyframes({
    from: { height: "var(--radix-accordion-content-height)" },
    to: { height: "0" },
});

export const accordionStyles = {
    item: style({
        width: "100%",
        borderBottom: `1px solid ${vars.border.subtle}`,
    }),
    header: style({
        display: "flex",
        fontSize: fs.m,
        fontWeight: 500,
    }),
    trigger: style({
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "space-between",
        gap: alias.spacing.s,
        border: "none",
        background: "none",
        padding: 0,
        fontFamily: "inherit",
        fontSize: "inherit",
        fontWeight: "inherit",
        color: "inherit",
        cursor: "pointer",
    }),
    chevron: style({
        display: "block",
        flexShrink: 0,
        transition: `transform 300ms ${easing}`,
        selectors: {
            "[data-state='open'] &": {
                transform: "rotate(180deg)",
            },
        },
    }),
    content: style({
        overflow: "hidden",
        selectors: {
            '&[data-state="open"]': {
                animation: `${slideDown} 300ms ${easing}`,
            },
            '&[data-state="closed"]': {
                animation: `${slideUp} 300ms ${easing}`,
            },
        },
    }),
};
