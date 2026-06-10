import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

/* ---- campaign type ---- */

/** Referral toggle row: a padded elevated cell, main text left, switch right. */
export const referralRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    width: "100%",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    backgroundColor: vars.surface.elevated,
});

export const referralMain = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    minWidth: 0,
});

/* ---- shared filled input (value + double-chevron stepper + unit glyph) ---- */

/** Wrapper on a numeric field: hides the native number spinner. */
export const inputWrapper = style({});
globalStyle(
    `${inputWrapper} input::-webkit-inner-spin-button, ${inputWrapper} input::-webkit-outer-spin-button`,
    { WebkitAppearance: "none", margin: 0 }
);
globalStyle(`${inputWrapper} input[type="number"]`, {
    MozAppearance: "textfield",
});

/** Double-chevron stepper: glyph with two stacked transparent hit zones. */
export const stepper = style({
    position: "relative",
    width: "24px",
    height: "24px",
    flexShrink: 0,
    color: vars.icon.secondary,
});
export const stepperIcon = style({ display: "block", pointerEvents: "none" });
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

/** Trailing unit glyph (EUR / %). */
export const unitIcon = style({ color: vars.icon.tertiary, flexShrink: 0 });

/** Trailing unit as text (e.g. "DAYS") — a word unit that must localise. */
export const unitText = style({
    flexShrink: 0,
    color: vars.icon.tertiary,
    fontSize: "14px",
    fontWeight: 500,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
});

/** 16px horizontal inset to line a label/hint up with the field text. */
export const insetX = style({
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

/* ---- reward model radios ---- */

export const modelRow = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "stretch",
    width: "100%",
    selectors: { "&&": { flexDirection: "row" } },
});

export const modelOption = style({
    display: "flex",
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: alias.spacing.m,
    padding: `${alias.spacing.m} ${alias.spacing.m} ${alias.spacing.m} 0`,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
    textAlign: "left",
});

export const modelMain = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    minWidth: 0,
});

/** 8px lift above the distribution bar (mirrors step 4, minus its padding). */
export const distributionGap = style({
    marginTop: alias.spacing.xs,
});

/**
 * 1px rule between the radios and the reveal section. The 4px margin adds to
 * the parent Stack's 16px gap for 20px of breathing room around the line.
 */
export const divider = style({
    width: "100%",
    height: "1px",
    backgroundColor: vars.border.subtle,
    marginTop: alias.spacing.xxs,
    marginBottom: alias.spacing.xxs,
});

/* ---- "Frak recommends" bar ---- */

export const recoBar = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    width: "100%",
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    backgroundColor: vars.surface.secondary,
    borderRadius: alias.cornerRadius.m,
});
export const recoIcon = style({ color: vars.text.action, flexShrink: 0 });
export const recoText = style({ flex: 1, minWidth: 0 });
/** The "80/20 reward" portion of the reco copy, in the action blue. */
export const recoHighlight = style({ color: vars.text.action });

/* ---- ambassador / referee recipient boxes ---- */

export const recipientGrid = style({
    display: "flex",
    gap: alias.spacing.m,
    width: "100%",
});
export const recipientBox = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    flex: 1,
    minWidth: 0,
    padding: alias.spacing.m,
    backgroundColor: vars.surface.tertiary,
    borderRadius: alias.cornerRadius.m,
});

/* ---- "triggered on …" footer ---- */

export const triggeredIcon = style({
    color: vars.text.success,
    flexShrink: 0,
});

/* ---- tiered table (static) ---- */

/** Column-header row (labels), shown once; mirrors `tierRow` widths. */
export const tierHeader = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-end",
    width: "100%",
});

/** A tier row: basket (flex 1) · value+unit group · delete. */
export const tierRow = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-end",
    width: "100%",
});

/** Basket range group: from → to. */
export const tierBasket = style({
    display: "flex",
    flex: 1,
    minWidth: 0,
    gap: alias.spacing.xxs,
    alignItems: "flex-end",
});
export const tierBasketInput = style({ flex: 1, minWidth: 0 });

/** Right-arrow between from/to, centred against the 56px input. */
export const tierArrow = style({
    display: "flex",
    alignItems: "center",
    height: "56px",
    flexShrink: 0,
    color: vars.icon.tertiary,
});

/** Value (CPA/reward) + Unit columns, 8px apart. */
export const tierValueUnit = style({
    display: "flex",
    gap: alias.spacing.xs,
    alignItems: "flex-end",
});
export const tierValue = style({ width: "153px", flexShrink: 0 });
export const tierUnit = style({ width: "88px", flexShrink: 0 });

/** Unit Select restyled as a grey 56px filled field (`&&` beats the DS base). */
export const unitTrigger = style({
    selectors: {
        "&&": {
            boxSizing: "border-box",
            height: "56px",
            width: "100%",
            backgroundColor: vars.surface.tertiary,
            border: "none",
            borderRadius: alias.cornerRadius.m,
            padding: `0 ${alias.spacing.m}`,
            fontSize: "16px",
            color: vars.text.primary,
        },
    },
});

/** White unit Select for the grey recipient cards, where grey would vanish. */
export const unitTriggerElevated = style([
    unitTrigger,
    { selectors: { "&&": { backgroundColor: vars.surface.elevated } } },
]);

/** Delete (trash) cell, centred against the 56px input. */
export const tierDelete = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "56px",
    width: "24px",
    flexShrink: 0,
    cursor: "pointer",
    color: vars.icon.secondary,
});
/** First tier can't be removed: keep the column width, hide the button. */
export const tierDeleteHidden = style({
    opacity: 0,
    pointerEvents: "none",
});

/** Header label, inset 16px to line up with the field text. */
export const tierLabel = style({
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});
export const tierLabelBasket = style({ flex: 1, minWidth: 0 });
export const tierLabelSpacer = style({ width: "24px", flexShrink: 0 });

/** "Frak keeps a 20% commission…" footnote, dimmed to 70%. */
export const tierFootnote = style({ opacity: 0.7 });

/** Table title clears the header row by 16px (8px gap + 8px margin). */
export const tierTitle = style({ marginBottom: alias.spacing.xs });

/** "Add a tier" sits 16px below the last row (8px gap + 8px margin). */
export const tierAddButton = style({ marginTop: alias.spacing.xs });

/**
 * Ambassador/Referee tables live in a grey card with white inputs — the inverse
 * of the Global-CPA table (grey inputs sitting directly on the white card).
 */
export const tierCard = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
    padding: alias.spacing.m,
    backgroundColor: vars.surface.tertiary,
    borderRadius: alias.cornerRadius.m,
});
