import { style, styleVariants } from "@vanilla-extract/css";

const buttonContainerBase = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "4px",
    color: "#ffffff",
    fontSize: "13px",
});

export const buttonContainer = styleVariants({
    default: [buttonContainerBase, {}],
    disabled: [
        buttonContainerBase,
        {
            opacity: 0.6,
            cursor: "not-allowed",
        },
    ],
});

export const button = style({
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
});

export const variant = styleVariants({
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
});
