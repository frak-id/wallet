import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

/* ---- budget period ---- */

/** Horizontal row of period radios. `&&` beats the DS RadioGroup column. */
export const periodRow = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "center",
    width: "100%",
    selectors: {
        "&&": {
            flexDirection: "row",
        },
    },
});

export const periodOption = style({
    display: "flex",
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
});

/* ---- budget cap ---- */

export const capContent = style({
    display: "flex",
    flexDirection: "column",
    width: "100%",
});

/** Wrapper on the cap field: hides the native number spinner. */
export const capInputWrapper = style({});
globalStyle(
    `${capInputWrapper} input::-webkit-inner-spin-button, ${capInputWrapper} input::-webkit-outer-spin-button`,
    {
        WebkitAppearance: "none",
        margin: 0,
    }
);
globalStyle(`${capInputWrapper} input[type="number"]`, {
    MozAppearance: "textfield",
});

/** Stepper (double-chevron) + EUR glyph on the right of the cap field. */
export const capRight = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
});

/** Double-chevron stepper: the glyph with two stacked, transparent hit zones. */
export const stepper = style({
    position: "relative",
    width: "24px",
    height: "24px",
    flexShrink: 0,
    color: vars.icon.secondary,
});

export const stepperIcon = style({
    display: "block",
    pointerEvents: "none",
});

const stepperZone = style({
    all: "unset",
    position: "absolute",
    left: 0,
    right: 0,
    height: "50%",
    cursor: "pointer",
});

export const stepperUp = style([stepperZone, { top: 0 }]);
export const stepperDown = style([stepperZone, { bottom: 0 }]);

/** Trailing currency glyph (€/£/$), tertiary colour, after the stepper. */
export const capGlyph = style({
    flexShrink: 0,
    minWidth: "24px",
    color: vars.icon.tertiary,
    fontSize: "16px",
    fontWeight: 500,
    lineHeight: "24px",
    textAlign: "center",
    whiteSpace: "nowrap",
});

/** Cap hint, 4px under the field, inset 16px to line up with the field text. */
export const capHint = style({
    marginTop: alias.spacing.xxs,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

/** Wrapper around the shared DistributionBar: 8px under the hint, 16px padTop. */
export const breakdown = style({
    marginTop: alias.spacing.xs,
    paddingTop: alias.spacing.m,
});

/* ---- schedule ---- */

/** 3 schedule options in a row. */
export const scheduleRow = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
    width: "100%",
    selectors: {
        "&&": {
            flexDirection: "row",
        },
    },
});

export const scheduleOption = style({
    display: "flex",
    flex: 1,
    minWidth: 0,
    gap: alias.spacing.m,
    alignItems: "center",
    padding: `${alias.spacing.m} ${alias.spacing.m} ${alias.spacing.m} 0`,
    cursor: "pointer",
    textAlign: "left",
});

export const scheduleMain = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    minWidth: 0,
});

/** 1px rule between the radios and the date input (4px above/below). */
export const divider = style({
    width: "100%",
    height: "1px",
    backgroundColor: vars.border.subtle,
    marginTop: alias.spacing.xxs,
    marginBottom: alias.spacing.xxs,
});

/* ---- date fields ---- */

export const dateFields = style({
    display: "flex",
    gap: alias.spacing.m,
    width: "100%",
});

export const dateColumn = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    flex: 1,
    minWidth: 0,
});

/** Date label, inset 16px to line up with the field text. */
export const dateLabel = style({
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});
