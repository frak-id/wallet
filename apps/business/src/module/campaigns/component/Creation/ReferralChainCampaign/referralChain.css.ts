import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

/* ---- enable toggle cell ---- */

/** Toggle cell surface; `Inline` handles the row layout + padding. */
export const toggleCell = style({
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.elevated,
});

/** Let the text block shrink so a long description wraps. */
export const toggleMain = style({ minWidth: 0 });

/* ---- inputs (% split + CAC) ---- */

/** Hide the native number spinner on the bare numeric inputs. */
export const inputWrapper = style({});
globalStyle(
    `${inputWrapper} input::-webkit-inner-spin-button, ${inputWrapper} input::-webkit-outer-spin-button`,
    { WebkitAppearance: "none", margin: 0 }
);
globalStyle(`${inputWrapper} input[type="number"]`, {
    MozAppearance: "textfield",
});

/** 16px horizontal inset to align label/hint with the field text. */
export const insetX = style({
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

export const field = style({ width: "100%", minWidth: 0 });

/** Two-line label slot, bottom-anchored, so inputs align across locales. */
export const fieldLabel = style({
    display: "flex",
    alignItems: "flex-end",
    minHeight: "44px",
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

/** Trailing percent glyph icon. */
export const unitIcon = style({ color: vars.icon.tertiary, flexShrink: 0 });

/** Trailing currency glyph, aligned to the 24px unit icons. */
export const unitGlyph = style({
    flexShrink: 0,
    minWidth: "24px",
    color: vars.icon.tertiary,
    fontSize: "16px",
    fontWeight: brand.typography.fontWeight.medium,
    lineHeight: "24px",
    textAlign: "center",
    whiteSpace: "nowrap",
});

/* ---- reward distribution chain preview ---- */

/** Preview surface: white fill with a dashed subtle border. */
export const schemaBox = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
    padding: `${alias.spacing.m} ${alias.spacing.m} ${alias.spacing.l}`,
    backgroundColor: vars.surface.elevated,
    border: `1px dashed ${vars.border.default}`,
    borderRadius: alias.cornerRadius.m,
});

export const schemaHeader = style({ textAlign: "center" });

/** Chain card: 167px min width, 75.5px min height, single-line title. */
const chainCardBase = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xxs,
    width: "fit-content",
    minWidth: "167px",
    minHeight: "75.5px",
    maxWidth: "100%",
    padding: "8px 16px",
    whiteSpace: "nowrap",
    backgroundColor: vars.surface.elevated,
    border: "1px solid transparent",
    borderRadius: alias.cornerRadius.m,
    textAlign: "center",
});

/** `1st Purchase` card: light-green fill + border. */
export const purchaseCard = style([
    chainCardBase,
    { backgroundColor: vars.surface.success, borderColor: vars.border.success },
]);

/** Direct reward card: white, green border. */
export const cardSuccess = style([
    chainCardBase,
    { borderColor: vars.border.success },
]);

/** Referral-chain reward card: white, orange border. */
export const cardWarning = style([
    chainCardBase,
    { borderColor: vars.border.warning },
]);

export const successText = style({ color: vars.text.success });
export const warningText = style({ color: vars.text.warning });

/** Connector arrow; negative top margin sits the dot on the card border. */
const arrowBase = style({ marginTop: "-3px", flexShrink: 0 });
export const arrowSuccess = style([arrowBase, { color: vars.border.success }]);
export const arrowWarning = style([arrowBase, { color: vars.border.warning }]);

/* ---- direct vs chain legend (split bar + LegendItem dots) ---- */

/** Proportion bar: 4px grey rail, green (direct) + orange (chain) segments. */
export const splitBar = style({
    display: "flex",
    width: "100%",
    height: "4px",
    borderRadius: "100px",
    overflow: "hidden",
    backgroundColor: "rgba(187, 196, 205, 0.5)",
});

/** 16px padding around the bar + legend group. */
export const legendGroup = style({
    paddingTop: alias.spacing.m,
    paddingBottom: alias.spacing.m,
});
export const splitSuccess = style({
    height: "100%",
    backgroundColor: vars.text.success,
});
export const splitWarning = style({
    height: "100%",
    backgroundColor: vars.text.warning,
});

/** Table amounts: coloured, medium weight. */
export const amountSuccess = style({
    color: vars.text.success,
    fontWeight: brand.typography.fontWeight.medium,
});
export const amountWarning = style({
    color: vars.text.warning,
    fontWeight: brand.typography.fontWeight.medium,
});
