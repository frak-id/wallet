import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const previewContainer = style({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
    width: "100%",
});

export const previewTitle = style({
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: brand.colors.neutral.white,
});

export const previewDescription = style({
    fontSize: "12px",
    color: "#858d9d",
    marginBottom: "0.5rem",
});
