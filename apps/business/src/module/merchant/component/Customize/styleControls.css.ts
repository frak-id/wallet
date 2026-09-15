import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { focusRing, interactive } from "@/module/common/styles/interaction.css";

const BOX_GRID = {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gridTemplateRows: "auto auto auto",
    alignItems: "center",
    justifyItems: "center",
    position: "relative",
} as const;

export const styleHeader = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
});

/** Matches one column of `settingsGrid`, so a lone field keeps half width. */
export const halfWidthRow = style({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: `${alias.spacing.s} ${alias.spacing.m}`,
    "@media": {
        "screen and (min-width: 560px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
    },
});

export const marginBox = style([
    BOX_GRID,
    {
        gap: alias.spacing.xxs,
        padding: `22px ${alias.spacing.s} ${alias.spacing.s}`,
        borderRadius: alias.cornerRadius.m,
        border: `1px dashed ${vars.border.default}`,
        backgroundColor: vars.surface.muted,
    },
]);

export const paddingBox = style([
    BOX_GRID,
    {
        gridRow: 2,
        gridColumn: 2,
        width: "100%",
        gap: alias.spacing.xxs,
        padding: `22px ${alias.spacing.xs} ${alias.spacing.xs}`,
        borderRadius: alias.cornerRadius.s,
        border: `1px dashed ${vars.border.default}`,
        backgroundColor: vars.surface.elevated,
    },
]);

export const boxCaption = style({
    position: "absolute",
    top: "6px",
    left: alias.spacing.xs,
    fontSize: "10px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: vars.text.tertiary,
});

const linkAnchor = {
    position: "absolute",
    top: "4px",
} as const;

export const marginLink = style([linkAnchor, { right: "38px" }]);

export const paddingLink = style([linkAnchor, { right: "34px" }]);

export const marginUnit = style([linkAnchor, { right: alias.spacing.s }]);

export const paddingUnit = style([linkAnchor, { right: alias.spacing.xs }]);

export const unitToggle = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "20px",
        height: "20px",
        paddingInline: "4px",
        cursor: "pointer",
        borderRadius: alias.cornerRadius.xs,
        backgroundColor: vars.surface.disabled,
        color: vars.text.secondary,
        fontSize: "10px",
        fontWeight: brand.typography.fontWeight.medium,
        selectors: {
            "&:hover": { color: vars.text.primary },
        },
    },
]);

export const linkToggle = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        cursor: "pointer",
        borderRadius: alias.cornerRadius.xs,
        color: vars.text.tertiary,
        selectors: {
            "&:hover": { color: vars.text.primary },
            "&[aria-pressed='true']": {
                color: vars.text.action,
                backgroundColor: vars.surface.disabled,
            },
        },
    },
]);

export const cellTop = style({ gridRow: 1, gridColumn: 2 });
export const cellLeft = style({ gridRow: 2, gridColumn: 1 });
export const cellRight = style({ gridRow: 2, gridColumn: 3 });
export const cellBottom = style({ gridRow: 3, gridColumn: 2 });

export const boxCore = style({
    gridRow: 2,
    gridColumn: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "34px",
    paddingInline: alias.spacing.xs,
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.surface.disabled,
    fontSize: fontSize.xs,
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const scrubInput = style({
    all: "unset",
    boxSizing: "border-box",
    width: "34px",
    padding: "2px 0",
    borderRadius: alias.cornerRadius.xs,
    cursor: "ew-resize",
    textAlign: "center",
    fontSize: fontSize.xs,
    fontVariantNumeric: "tabular-nums",
    color: vars.text.primary,
    touchAction: "none",
    "::placeholder": {
        color: vars.text.disabled,
        opacity: 1,
    },
    selectors: {
        "&:hover": { backgroundColor: vars.surface.disabled },
        "&:focus-visible": {
            outline: `2px solid ${vars.border.focus}`,
            cursor: "text",
        },
    },
});

export const scrubInputMargin = style({
    color: vars.text.secondary,
});

export const scrubInputActive = style({
    backgroundColor: vars.surface.disabled,
    userSelect: "none",
});
