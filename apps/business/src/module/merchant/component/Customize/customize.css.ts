import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { focusRing, interactive } from "@/module/common/styles/interaction.css";

export const switchRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    paddingBlock: alias.spacing.m,
});

export const radioRow = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    minHeight: "84px",
    padding: alias.spacing.m,
});

export const radioRowLabel = style({
    flex: 1,
    cursor: "pointer",
});

export const presetRow = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    minHeight: "48px",
});

/** The design's segmented track is darker than the component default. */
export const segmentedTrack = style({
    backgroundColor: vars.surface.disabled,
});

export const rewardHint = style({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: alias.spacing.xs,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.muted,
    fontSize: fontSize.s,
    lineHeight: "22px",
    color: vars.text.secondary,
});

export const rewardToken = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: alias.spacing.xs,
        cursor: "pointer",
        paddingInline: alias.spacing.xs,
        paddingBlock: "2px",
        borderRadius: alias.cornerRadius.s,
        border: `1px solid ${vars.border.default}`,
        backgroundColor: vars.surface.elevated,
        fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        fontSize: fontSize.s,
        color: vars.text.primary,
        selectors: {
            "&:hover": { backgroundColor: vars.surface.disabled },
        },
    },
]);

export const settingsGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: `${alias.spacing.s} ${alias.spacing.m}`,
});

export const advancedToggle = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: alias.spacing.xs,
        cursor: "pointer",
        paddingBlock: alias.spacing.s,
        fontSize: fontSize.s,
        lineHeight: "22px",
        fontWeight: brand.typography.fontWeight.medium,
        color: vars.text.secondary,
        selectors: {
            "&:hover": {
                color: vars.text.primary,
            },
        },
    },
]);

export const advancedBody = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    paddingTop: alias.spacing.xs,
});

export const colorRow = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const colorField = style({
    flex: 1,
    minWidth: 0,
});

/** Reserves the widest action set, so a row without "none" keeps field width. */
export const colorActions = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    flexShrink: 0,
    minWidth: "150px",
});

/** The hairline sits on the swatch itself, so a near-white colour stays visible. */
export const colorSwatch = style({
    width: "32px",
    height: "32px",
    padding: 0,
    flexShrink: 0,
    cursor: "pointer",
    appearance: "none",
    background: "none",
    border: "none",
    borderRadius: alias.cornerRadius.s,
    selectors: {
        "&::-webkit-color-swatch-wrapper": { padding: 0 },
        "&::-webkit-color-swatch": {
            border: `1px solid ${vars.border.default}`,
            borderRadius: alias.cornerRadius.s,
        },
        "&::-moz-color-swatch": {
            border: `1px solid ${vars.border.default}`,
            borderRadius: alias.cornerRadius.s,
        },
        "&:disabled": { cursor: "not-allowed", opacity: 0.5 },
    },
});

export const styleGhostButton = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        flexShrink: 0,
        paddingInline: alias.spacing.xs,
        paddingBlock: "2px",
        borderRadius: alias.cornerRadius.s,
        color: vars.text.secondary,
        fontSize: fontSize.xs,
        selectors: {
            "&:hover": { color: vars.text.primary },
            "&[aria-pressed='true']": {
                color: vars.text.primary,
                backgroundColor: vars.surface.muted,
            },
        },
    },
]);

export const cssTextarea = style({
    all: "unset",
    boxSizing: "border-box",
    width: "100%",
    minHeight: "200px",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.muted,
    fontSize: fontSize.s,
    lineHeight: "22px",
    color: vars.text.primary,
    fontFamily: '"SF Mono", Menlo, Consolas, monospace',
    resize: "vertical",
});

globalStyle(`${cssTextarea}::placeholder`, {
    color: vars.text.disabled,
    opacity: 1,
});

export const dialogBody = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
});

export const deleteButton = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: alias.spacing.xs,
        cursor: "pointer",
        paddingInline: alias.spacing.m,
        paddingBlock: alias.spacing.s,
        borderRadius: alias.cornerRadius.s,
        border: `1px solid ${vars.border.error}`,
        color: vars.text.error,
        backgroundColor: vars.surface.error,
        fontSize: fontSize.s,
        lineHeight: "22px",
        fontWeight: brand.typography.fontWeight.semiBold,
        selectors: {
            "&:hover": { backgroundColor: alias.error[200] },
        },
    },
]);
