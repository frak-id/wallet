import { recipe } from "@vanilla-extract/recipes";

export const buttonContainer = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "4px",
        color: "#ffffff",
        fontSize: "13px",
    },
    variants: {
        disabled: {
            true: {
                opacity: 0.6,
                cursor: "not-allowed",
            },
            false: {},
        },
    },
    defaultVariants: {
        disabled: false,
    },
});

export const button = recipe({
    base: {
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: "pointer",
        outline: "none",
        borderRadius: "50%",
        border: "none",
        width: "55px",
        height: "55px",
        backdropFilter: "blur(14px)",
        color: "#ffffff",
        selectors: {
            "&:disabled": {
                cursor: "not-allowed",
            },
        },
    },
    variants: {
        variant: {
            primary: {
                background: "#00000059",
                color: "#ffffff",
            },
            danger: {
                background: "#ff000080",
            },
            success: {
                background: "#34ff3475",
            },
            disabled: {
                background: "#4c4c4c59",
            },
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});
