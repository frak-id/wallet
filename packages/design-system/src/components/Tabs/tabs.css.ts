import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const tabsList = recipe({
    base: {
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "flex-start",
        width: "fit-content",
    },
    variants: {
        variant: {
            // Grey-track segmented control (default), content-sized.
            segmented: {
                padding: "2px",
                borderRadius: "10px",
                backgroundColor: vars.surface.muted,
            },
            // Trackless navigation bar — active tab is a floating white pill
            // (Figma "Tabs - Navigation bar").
            navigation: {
                gap: "0",
            },
        },
        // Opt-in: stretch the list to fill its container so triggers can split
        // the row equally (paired with `fullWidth` on each TabsTrigger).
        fullWidth: {
            true: { width: "100%" },
            false: {},
        },
    },
    defaultVariants: {
        variant: "segmented",
        fullWidth: false,
    },
});

export const tabsTrigger = recipe({
    base: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        fontFamily: "inherit",
        fontSize: "14px",
        lineHeight: "22px",
        fontWeight: 500,
        color: vars.text.disabled,
        cursor: "pointer",
        transition: "background-color 0.15s ease, color 0.15s ease",
        whiteSpace: "nowrap",
        ":focus": {
            outline: "none",
        },
        // Keyboard-only grey ring, matching the rest of the DS controls.
        ":focus-visible": {
            boxShadow: `0 0 0 2px ${vars.border.focus}`,
        },
        selectors: {
            '&:not([data-state="active"]):hover': {
                color: vars.text.secondary,
            },
            "&:disabled": {
                cursor: "not-allowed",
                opacity: 0.5,
            },
        },
    },
    variants: {
        variant: {
            segmented: {
                height: "28px",
                paddingLeft: alias.spacing.xl,
                paddingRight: alias.spacing.xl,
                borderRadius: alias.cornerRadius.s,
                selectors: {
                    '&[data-state="active"]': {
                        backgroundColor: vars.surface.elevated,
                        color: vars.text.primary,
                    },
                },
            },
            navigation: {
                height: "36px",
                paddingLeft: alias.spacing.m,
                paddingRight: alias.spacing.m,
                paddingTop: alias.spacing.xs,
                paddingBottom: alias.spacing.xs,
                borderRadius: alias.cornerRadius.m,
                selectors: {
                    '&[data-state="active"]': {
                        backgroundColor: vars.surface.elevated,
                        color: vars.text.primary,
                    },
                },
            },
        },
        // Opt-in: each trigger grows to split the row equally (paired with
        // `fullWidth` on TabsList).
        fullWidth: {
            true: { flex: 1, minWidth: 0 },
            false: {},
        },
    },
    defaultVariants: {
        variant: "segmented",
        fullWidth: false,
    },
});

export const tabsContent = style({
    outline: "none",
});
