import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Repaints the `DetailSheet` with `surface.background2` so the white
 * elevated cards stand out as Figma shows. Overrides both the mobile
 * overlay bg and the desktop (>=1024px) `surface.background` rule.
 */
export const sheetSurface = style({
    backgroundColor: vars.surface.background2,
    "@media": {
        "screen and (min-width: 1024px)": {
            backgroundColor: vars.surface.background2,
        },
    },
});

/**
 * Body wrapper. Vertical padding intentionally omitted — the toolbar
 * already contributes `pb-xs` and the footer owns its own spacing.
 */
export const bodyStack = style({
    paddingInline: alias.spacing.m,
    flexGrow: 1,
});

export const featureCell = style({
    paddingInline: alias.spacing.m,
    paddingBlock: alias.spacing.s,
    width: "100%",
});

/**
 * The 2px block padding optically aligns the icon with the title row,
 * matching Figma's `py-[2px]` on the cell's Left column.
 */
export const featureIconSlot = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingBlock: "2px",
    color: vars.icon.primary,
    flexShrink: 0,
});

/**
 * 12/16 padding instead of the `Card` recipe's 16/16 default — Figma
 * specifies a tighter cell so each row sits at ~62px tall.
 */
export const transferCellPadding = style({
    paddingBlock: alias.spacing.s,
    paddingInline: alias.spacing.m,
});

/**
 * `position: relative` so the centered switcher disc can absolute-pos
 * over the gap between the two cards.
 */
export const cardsStack = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const switcherIcon = style({
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "32px",
    height: "32px",
    pointerEvents: "none",
    zIndex: 1,
});

export const switcherDisc = style({
    width: "32px",
    height: "32px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.background2,
    color: vars.icon.secondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const amountSection = style({
    paddingTop: "26px",
});

/**
 * Width is set inline via `style={{ width: \`${len}ch\` }}` so the input
 * grows with the typed value across all targets (`field-sizing: content`
 * is Safari 17.4+ / Chrome 123+, below our baseline). `tabular-nums`
 * makes digits uniform-width so the `ch` approximation stays accurate.
 * `caretColor: text.action` keeps the native cursor visible in brand blue.
 */
export const amountInput = style({
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: vars.text.primary,
    fontSize: fontSize["5xl"],
    lineHeight: "1",
    fontWeight: 700,
    textAlign: "left",
    padding: 0,
    margin: 0,
    fontFamily: "inherit",
    fontVariantNumeric: "tabular-nums",
    caretColor: vars.text.action,
    "::placeholder": {
        color: vars.text.disabled,
    },
});

/**
 * Unstyled button reset for toolbar slots / inline actions. Lets the
 * surrounding `Text` component fully control the look.
 */
export const linkButton = style({
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
});

export const recapRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    paddingBlock: alias.spacing.s,
    paddingInline: alias.spacing.m,
    width: "100%",
    minHeight: "49px",
});

export const noteClearButton = style({
    flexShrink: 0,
    width: "24px",
    height: "24px",
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: vars.icon.secondary,
});

export const walletCardError = style({
    backgroundColor: vars.surface.error,
});

export const ibanRow = style({
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
});

/**
 * Hits `text.action` directly because the design-system has no
 * `border.action` token (its `border.focus` resolves to grey-400, which
 * vanishes against a white card on `surface.background2`). `outline`
 * (not `border`) avoids any layout shift between selected states.
 */
export const ibanCardSelected = style({
    outline: `1.5px solid ${vars.text.action}`,
    outlineOffset: "-1.5px",
});
