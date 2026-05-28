import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

// Anchor for the absolutely-positioned month-nav buttons (left/right
// 4px). Without it they resolve to the nearest positioned ancestor —
// e.g. a wider popover — and drift away from the calendar's edges.
export const root = style({ position: "relative", padding: alias.spacing.s });

// Lays out the month blocks; multiple months (numberOfMonths > 1) sit
// side by side. The absolutely-positioned nav is exempt from this flow.
export const months = style({
    display: "flex",
    flexDirection: "row",
    gap: alias.spacing.l,
});

const captionHeight = "32px";

export const caption = style({
    display: "flex",
    position: "relative",
    height: captionHeight,
    justifyContent: "center",
    alignItems: "center",
    fontWeight: brand.typography.fontWeight.medium,
});

// Full-width row overlaying the caption so the arrows sit on the same
// line as the month label (prev hard-left, next hard-right), shadcn-style.
export const nav = style({
    position: "absolute",
    // Offset by the root's padding so the row lines up with the caption,
    // which sits inside the padded content box (top:0 anchors to the
    // padding-box edge and would float the arrows above the label).
    top: alias.spacing.s,
    left: 0,
    right: 0,
    zIndex: 1,
    height: captionHeight,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
});

const navButtonBase = {
    all: "unset" as const,
    boxSizing: "border-box" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: captionHeight,
    height: captionHeight,
    borderRadius: alias.cornerRadius.s,
    border: `1px solid ${vars.border.subtle}`,
    color: vars.text.primary,
    cursor: "pointer",
    selectors: {
        "&:hover": { backgroundColor: vars.surface.muted },
        "&:disabled": { cursor: "not-allowed", opacity: 0.5 },
    },
};

export const navButtonPrevious = style([navButtonBase]);

export const navButtonNext = style([navButtonBase]);

export const table = style({
    marginTop: alias.spacing.m,
    width: "100%",
    borderCollapse: "collapse",
});

export const headRow = style({ display: "flex" });

export const headCell = style({
    fontWeight: brand.typography.fontWeight.regular,
    width: "36px",
});

export const tbody = style({ marginTop: "4px" });

export const row = style({
    display: "flex",
    marginTop: "8px",
    width: "100%",
});

export const cell = style({
    position: "relative",
    padding: 0,
    lineHeight: "20px",
    width: "36px",
    height: "36px",
});

export const day = style({
    padding: 0,
    width: "36px",
    height: "36px",
    justifyContent: "center",
    borderRadius: alias.cornerRadius.s,
    selectors: {
        "&:hover": { backgroundColor: brand.colors.neutral.grey250 },
    },
});

export const daySelected = style({
    backgroundColor: brand.colors.neutral.grey250,
    borderRadius: alias.cornerRadius.s,
});

export const dayToday = style({
    backgroundColor: brand.colors.primary[100],
    borderRadius: alias.cornerRadius.s,
});

export const dayOutside = style({ opacity: 0.5 });

export const dayDisabled = style({ opacity: 0.5 });

/**
 * Range-mode helpers. The middle days get a flat fill that bleeds to
 * the cell edges so the selected range reads as a continuous band;
 * the endpoints keep their rounded corners on the outer side. When
 * `range_start` and `range_end` apply to the same cell (single-day
 * range, or only `from` picked), both outer sides stay rounded and
 * the cell reads as a normal selected pill.
 */
export const rangeMiddle = style({
    backgroundColor: brand.colors.primary[100],
    borderRadius: 0,
});

export const rangeStart = style({
    backgroundColor: brand.colors.primary[500],
    borderTopLeftRadius: alias.cornerRadius.s,
    borderBottomLeftRadius: alias.cornerRadius.s,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
});

export const rangeEnd = style({
    backgroundColor: brand.colors.primary[500],
    borderTopRightRadius: alias.cornerRadius.s,
    borderBottomRightRadius: alias.cornerRadius.s,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
});

// Solid endpoints need white numbers (the ghost day button is blue).
globalStyle(`${rangeStart} button, ${rangeEnd} button`, {
    color: brand.colors.neutral.white,
});

/**
 * Single-day range: react-day-picker stamps `{from: date, to: date}`
 * on the first click (see `addToRange.js`), so the cell carries both
 * `range_start` and `range_end`. Without this rule the later class
 * (rangeEnd) would zero the outer-left corners. Force fully rounded
 * when both apply.
 */
globalStyle(`${rangeStart}${rangeEnd}`, {
    borderRadius: alias.cornerRadius.s,
});
