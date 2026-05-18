import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const radioGroup = style({
    display: "flex",
    flexDirection: "column",
});

export const radioGroupIndicator = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    position: "relative",
});

globalStyle(`${radioGroupIndicator}::after`, {
    content: '""',
    display: "block",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "white",
});

export const radioGroupItem = style({
    all: "unset",
    backgroundColor: "white",
    width: "20px",
    height: "20px",
    borderRadius: "100%",
    border: "2px solid #94979f",
    cursor: "pointer",
    selectors: {
        "&:focus-visible": {
            boxShadow: `0 0 0 1px ${brand.colors.primary[500]}`,
        },
        [`&:has(.${radioGroupIndicator.split(" ")[0]})`]: {
            background: "#94979f",
        },
    },
});
