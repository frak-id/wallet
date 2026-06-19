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

export const presetGrid = style({
    gap: alias.spacing.m,
    selectors: {
        // "&&" outranks the RadioGroup base (display: flex, column).
        "&&": {
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
    },
    "@media": {
        "screen and (max-width: 640px)": {
            selectors: {
                "&&": {
                    gridTemplateColumns: "1fr",
                },
            },
        },
    },
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
