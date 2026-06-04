import { brand, safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const stepLayout = style({
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    paddingTop: safeArea.top,
    paddingBottom: safeArea.bottom,
});

export const stepLayoutContent = style({
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: `${brand.scale[1200]} ${brand.scale[600]}`,
});

export const stepLayoutFooter = style({
    padding: `${brand.scale[600]} ${brand.scale[500]}`,
    display: "flex",
    flexDirection: "column",
    gap: brand.scale[300],
    alignItems: "center",
});
