import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    padding: alias.spacing.l,
});

export const tabsContent = style({
    marginTop: alias.spacing.l,
});

export const twoCol = style({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: alias.spacing.m,
});

export const threeCol = style({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: alias.spacing.m,
});

// Big metric value — tabular figures so amounts line up across cards.
export const amount = style({
    fontSize: "32px",
    lineHeight: "40px",
    fontWeight: 600,
    color: vars.text.primary,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.01em",
});

// Decimal/fraction part rendered smaller, baseline-aligned (Figma "Decimals").
export const amountFraction = style({
    fontSize: "20px",
    fontWeight: 600,
});

// Layout only — font/line-height/weight come from <Text variant="bodySmall">,
// tone color from the <Text color> prop.
export const trendLine = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
});

// CPA breakdown — font/line-height/weight from <Text variant="body" weight="semiBold">.
export const cpaAmount = style({
    fontVariantNumeric: "tabular-nums",
});

export const cpaBar = style({
    display: "flex",
    width: "100%",
    height: "4px",
    borderRadius: alias.cornerRadius.full,
    overflow: "hidden",
});

export const cpaSegment = style({
    height: "100%",
});

export const legendSquare = style({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
});

export const subtitleDot = style({ color: vars.text.tertiary });
