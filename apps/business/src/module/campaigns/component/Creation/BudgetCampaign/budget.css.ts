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

/** EUR code glyph, tertiary colour, after the stepper. */
export const eurIcon = style({
    flexShrink: 0,
    color: vars.icon.tertiary,
});

/** Cap hint, 4px under the field, inset 16px to line up with the field text. */
export const capHint = style({
    marginTop: alias.spacing.xxs,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

/** Bar + legend: 8px under the hint + 16px inner padding, 16px bar/legend. */
export const breakdown = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    marginTop: alias.spacing.xs,
    paddingTop: alias.spacing.m,
});

/** Two-segment proportion bar (rewards 80% / Frak 20%). */
export const bar = style({
    display: "flex",
    width: "100%",
    height: "4px",
    borderRadius: "100px",
    overflow: "hidden",
});

export const barRewards = style({
    width: "80%",
    backgroundColor: vars.text.success,
});

export const barCommission = style({
    width: "20%",
    backgroundColor: vars.surface.primary,
});

/** Greyed segments when no amount is set yet. */
export const barEmpty = style({
    width: "100%",
    backgroundColor: vars.surface.disabled,
});

export const legend = style({
    display: "flex",
    gap: alias.spacing.xl,
    alignItems: "center",
});

export const legendItem = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
});

export const legendSquare = style({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
});

export const squareRewards = style({ backgroundColor: vars.text.success });
export const squareCommission = style({
    backgroundColor: vars.surface.primary,
});
export const squareEmpty = style({ backgroundColor: vars.icon.disabled });

/** Coloured amount inside each legend label. */
export const amountRewards = style({ color: vars.text.success });
export const amountCommission = style({ color: vars.text.action });

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
    gap: alias.spacing.xxs,
    flex: 1,
    minWidth: 0,
});

/** Date trigger styled like the other muted fields. */
export const dateField = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    width: "100%",
    height: "56px",
    padding: `0 ${alias.spacing.m}`,
    backgroundColor: vars.surface.tertiary,
    borderRadius: alias.cornerRadius.m,
    cursor: "pointer",
});

export const datePlaceholder = style({
    color: vars.text.disabled,
    fontSize: "16px",
    lineHeight: "26px",
});

export const dateValue = style({
    color: vars.text.primary,
    fontSize: "16px",
    lineHeight: "26px",
});

export const dateIcon = style({
    color: vars.icon.secondary,
    flexShrink: 0,
});
