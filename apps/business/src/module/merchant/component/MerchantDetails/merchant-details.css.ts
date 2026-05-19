import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const textarea = style({
    all: "unset",
    boxSizing: "border-box",
    padding: "9px 12px",
    width: "320px",
    minHeight: "100px",
    lineHeight: "20px",
    fontSize: "16px",
    color: "#333843",
    fontWeight: brand.typography.fontWeight.regular,
    border: "1px solid #e0e2e7",
    borderRadius: "8px",
    backgroundColor: "#f9f9fc",
    transition: "border-color 0.2s",
    resize: "vertical",
    selectors: {
        "&:focus": {
            boxShadow: "0 0 0 1px #5c59e8",
        },
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.6,
        },
    },
});

globalStyle(`${textarea}::placeholder`, {
    color: "#858d9d",
    opacity: 1,
});
