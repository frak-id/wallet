import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Sub-field label inset 16px to line up with the text inside a bare input. */
export const inputLabel = style({
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

/* ---- currency ---- */

/** 2×2 grid of currency cells. `&&` beats the DS RadioGroup base flex-column. */
export const currencyGrid = style({
    width: "100%",
    selectors: {
        "&&": {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: alias.spacing.m,
        },
    },
});

export const currencyCell = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    paddingTop: alias.spacing.m,
    paddingBottom: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
});

/** Flag/coin icon + code/provider text sit together (8px gap). */
export const currencyLabel = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    minWidth: 0,
});

/* ---- info bar ---- */

export const infoBar = style({
    backgroundColor: vars.surface.secondary,
    borderRadius: alias.cornerRadius.m,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.l,
    paddingTop: alias.spacing.s,
    paddingBottom: alias.spacing.s,
    color: vars.text.primary,
});

/* ---- DNS ---- */

export const dnsBlock = style({
    backgroundColor: vars.surface.tertiary,
    borderRadius: alias.cornerRadius.m,
    padding: alias.spacing.m,
});

export const dnsRecordBox = style({
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.m,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

/** Record value + copy button row, flush under the helper. */
export const dnsRecordRow = style({
    paddingBottom: alias.spacing.m,
});

/** Single-line, ellipsised TXT record value. */
export const dnsRecordValue = style({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const dnsCopyButton = style({
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px 0",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: vars.icon.secondary,
    ":hover": {
        color: vars.icon.primary,
    },
});

export const dnsHelpBox = style({
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.l,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
    paddingTop: alias.spacing.l,
    paddingBottom: alias.spacing.l,
});

/** Single-card accordion — drop the DS item divider line. */
export const dnsHelpItem = style({
    selectors: {
        "&&": {
            borderBottom: "none",
        },
    },
});

/** Reset the `<button>` UA centre alignment so the question reads left. */
export const dnsHelpTrigger = style({
    textAlign: "left",
});

/** Gap the expanded help body 16px below the question row. */
export const dnsHelpContent = style({
    paddingTop: alias.spacing.m,
});

/** External "View DNS Setup Guide" link, styled as a small secondary button. */
export const dnsHelpLink = style({
    alignSelf: "flex-start",
    textDecoration: "none",
});

/* ---- step 2: summary + instructions ---- */

export const summaryList = style({
    backgroundColor: vars.surface.tertiary,
    borderRadius: alias.cornerRadius.m,
    overflow: "hidden",
});

/** Detail row: 49px tall, content vertically centred (matches campaign summary). */
export const summaryRow = style({
    minHeight: 49,
});

export const instructions = style({
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.l,
});

export const instructionText = style({
    lineHeight: "30px",
});
