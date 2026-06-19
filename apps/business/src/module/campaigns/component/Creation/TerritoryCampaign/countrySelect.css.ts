import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import {
    focusRing,
    focusRingInset,
    interactive,
} from "@/module/common/styles/interaction.css";

/* ---- trigger (the field) ---- */

export const trigger = style({
    boxSizing: "border-box",
    display: "flex",
    // Stretch so the content column owns the full height: the right-hand
    // icons still center themselves, while the content can pin its top.
    alignItems: "stretch",
    gap: alias.spacing.xs,
    width: "100%",
    minHeight: "68px",
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
    backgroundColor: vars.surface.tertiary,
    borderRadius: alias.cornerRadius.m,
    border: "none",
    cursor: "pointer",
    textAlign: "left",
});

/** Invalid state — fills the field with the error surface (declared after
 * `trigger` so its background wins over the default tone). */
export const triggerError = style({
    backgroundColor: vars.surface.error,
});

/** The filled error icon shown inside the field, left of the chevron. */
export const errorIcon = style({
    color: vars.icon.error,
    flexShrink: 0,
});

/**
 * Left column. Empty → placeholder centered. Filled → label pinned to the
 * top with chips below, so the label doesn't drift up as more chips wrap.
 */
export const triggerContent = style({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: alias.spacing.xxs,
    flex: 1,
    minWidth: 0,
});

export const triggerContentFilled = style({
    justifyContent: "flex-start",
});

/** Small "Select country" label shown above the chips once filled. */
export const fieldLabel = style({
    color: vars.text.disabled,
    fontSize: "12px",
    lineHeight: "20px",
});

export const chips = style({
    display: "flex",
    flexWrap: "wrap",
    gap: alias.spacing.xxs,
    alignItems: "center",
});

export const placeholder = style({
    color: vars.text.disabled,
    fontSize: "16px",
    lineHeight: "26px",
});

export const chip = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xxs,
    paddingLeft: alias.spacing.s,
    paddingRight: alias.spacing.s,
    paddingTop: "1px",
    paddingBottom: "1px",
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.m,
    overflow: "hidden",
});

export const chipRemove = style([
    focusRing,
    {
        all: "unset",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: vars.text.primary,
        cursor: "pointer",
    },
]);

export const right = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    flexShrink: 0,
    color: vars.icon.secondary,
});

export const clearButton = style([
    interactive,
    focusRing,
    {
        all: "unset",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        // The CloseCircleIcon is itself the grey circle (X knocked out).
        color: vars.text.secondary,
        cursor: "pointer",
        selectors: {
            "&:hover": { color: vars.text.primary },
        },
    },
]);

/* ---- popover content ---- */

export const content = style({
    boxSizing: "border-box",
    backgroundColor: vars.surface.elevated,
    overflow: "hidden",
    width: "var(--radix-popover-trigger-width)",
    // `&&` beats the DS popover base shadow/radius (equal specificity).
    selectors: {
        "&&": {
            borderRadius: alias.cornerRadius.m,
            boxShadow: "0px 3px 8px rgba(0, 0, 0, 0.1)",
            padding: 0,
        },
    },
});

export const searchRow = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    height: "56px",
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
    borderBottom: `1px solid ${vars.border.subtle}`,
});

export const searchInput = style({
    all: "unset",
    flex: 1,
    minWidth: 0,
    fontSize: "16px",
    lineHeight: "26px",
    color: vars.text.primary,
    "::placeholder": {
        color: vars.text.tertiary,
    },
});

export const searchIcon = style({
    color: vars.icon.tertiary,
    flexShrink: 0,
});

/** Tall enough for the 7 collapsed continent rows (7 × 48px) — the default
 * view scrolls only once a continent is expanded. */
export const list = style({
    maxHeight: "336px",
    overflowY: "auto",
    width: "100%",
});

/** A continent or (searched) country row. */
export const row = style([
    interactive,
    focusRingInset,
    {
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: alias.spacing.xxs,
        height: "48px",
        paddingLeft: alias.spacing.m,
        paddingRight: alias.spacing.m,
        width: "100%",
        cursor: "pointer",
        selectors: {
            "&:hover": {
                backgroundColor: vars.surface.secondaryHover,
            },
        },
    },
]);

/** A country row nested under an expanded continent (indented, no chevron). */
export const rowCountry = style({
    gap: alias.spacing.xs,
    paddingLeft: "40px",
});

/** Expand toggle (chevron + name) on a continent row. */
export const expandButton = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    flex: 1,
    height: "100%",
    cursor: "pointer",
});

/** A country row is a `<label>` so the native control toggles the checkbox. */
export const countryLabel = style([
    interactive,
    focusRingInset,
    {
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: alias.spacing.xs,
        height: "48px",
        paddingLeft: alias.spacing.m,
        paddingRight: alias.spacing.m,
        width: "100%",
        cursor: "pointer",
        selectors: {
            "&:hover": {
                backgroundColor: vars.surface.secondaryHover,
            },
        },
    },
]);

/* ---- empty state (search matched no country) ---- */

/** Empty-state block shown when a search matches no country. */
export const empty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.l,
    paddingTop: alias.spacing.m,
    paddingBottom: alias.spacing.l,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
    width: "100%",
});

/** Circular accent badge wrapping the search icon. */
export const emptyBadge = style({
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: alias.size.xl,
    height: alias.size.xl,
    padding: "10px",
    backgroundColor: vars.surface.secondary,
    borderRadius: alias.cornerRadius.full,
    color: vars.icon.action,
});
