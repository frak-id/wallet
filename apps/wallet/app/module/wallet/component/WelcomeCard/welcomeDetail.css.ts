import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { NATIVE_BOTTOM_ACTION_HEIGHT_VAR } from "@/module/native-glass/constants";

/**
 * Hero image — cover the hero area, centered.
 */
export const heroImage = style({
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

/**
 * Content
 */
export const sectionContent = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

/** Clears the native prominent glass CTA (iOS 26), whose height UIKit reports. */
export const sectionContentNativeFooter = style([
    sectionContent,
    {
        paddingBottom: `calc(var(${NATIVE_BOTTOM_ACTION_HEIGHT_VAR}, 72px) + ${alias.spacing.m})`,
    },
]);
