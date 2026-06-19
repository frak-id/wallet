import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { focusRing, interactive } from "@/module/common/styles/interaction.css";

/**
 * Upload-field styles shared by the merchant Edit pages (Customize panels
 * and Explorer App settings). Labeled-field layout lives in
 * `@/module/forms/EditField`.
 */

/** Label/hint inset aligns with the input text (16px padding). */
export const fieldLabel = style({
    paddingInline: alias.spacing.m,
});

export const fieldHint = style({
    paddingInline: alias.spacing.m,
    margin: 0,
    fontSize: fontSize.xs,
    lineHeight: "20px",
    color: vars.text.tertiary,
});

export const dropzone = style([
    focusRing,
    {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: alias.spacing.m,
        padding: alias.spacing.m,
        borderRadius: alias.cornerRadius.m,
        border: `1px dashed ${vars.border.default}`,
        backgroundColor: vars.surface.muted,
    },
]);

export const dropzoneActive = style({
    borderColor: vars.border.focus,
    backgroundColor: vars.surface.secondary,
});

export const dropzoneIcon = style({
    color: vars.icon.action,
});

export const clearButton = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        width: "24px",
        height: "24px",
        borderRadius: alias.cornerRadius.full,
        color: vars.text.secondary,
        selectors: {
            "&:hover": {
                color: vars.text.primary,
            },
        },
    },
]);

export const thumbnailButton = style([
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        width: "48px",
        height: "48px",
        borderRadius: alias.cornerRadius.m,
        border: `1px solid ${vars.border.default}`,
        overflow: "hidden",
        flexShrink: 0,
    },
]);

export const thumbnailImage = style({
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
});
