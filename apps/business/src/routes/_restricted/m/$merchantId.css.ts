import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const platformAdminBanner = style({
    background: brand.colors.primary[800],
    color: brand.colors.primary[100],
    padding: "8px 16px",
    textAlign: "center",
    fontSize: "0.875rem",
    fontWeight: brand.typography.fontWeight.semiBold,
    borderBottom: `2px solid ${brand.colors.primary[500]}`,
    position: "sticky",
    top: 0,
});
