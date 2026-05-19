import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const filtersCount = style({
    display: "block",
    width: "18px",
    height: "18px",
    padding: "2px 6px",
    borderRadius: "100px",
    background: "#5c59e8",
    color: brand.colors.neutral.white,
    fontSize: "10px",
    fontWeight: brand.typography.fontWeight.semiBold,
    lineHeight: "14px",
});
