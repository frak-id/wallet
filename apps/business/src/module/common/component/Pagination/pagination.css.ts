import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const pagination = style({
    display: "flex",
    justifyContent: "center",
});

export const paginationContent = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "10px",
});

export const paginationLink = style({
    justifyContent: "center",
    width: "32px",
    height: "32px",
    backgroundColor: brand.colors.primary[100],
    color: brand.colors.primary[500],
});

export const paginationLinkActive = style({
    backgroundColor: brand.colors.primary[500],
    color: brand.colors.neutral.white,
});

export const paginationMore = style({
    display: "flex",
    alignItems: "flex-end",
    borderRadius: "8px",
});
