import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const tooltipTable = style({
    position: "absolute",
    left: "-1px",
    top: "-1px",
    zIndex: 1,
    backgroundColor: brand.colors.neutral.white,
    border: "1px solid #d5d5d5",
    borderRadius: "8px",
    padding: "20px",
    maxWidth: "330px",
    width: "max-content !important",
    whiteSpace: "normal",
    fontSize: "16px",
    fontWeight: 400,
});
