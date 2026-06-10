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

export const subtitleDot = style({ color: vars.text.tertiary });

// --- Configuration tab ---------------------------------------------------

// A label/value definition row with a hairline separator between entries.
export const definitionRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: alias.spacing.m,
    paddingTop: alias.spacing.s,
    paddingBottom: alias.spacing.s,
    borderTop: `1px solid ${vars.border.subtle}`,
    selectors: {
        "&:first-child": {
            paddingTop: 0,
            borderTop: "none",
        },
        "&:last-child": {
            paddingBottom: 0,
        },
    },
});

// Value side of a definition row — right aligned, can wrap onto a new line.
export const definitionValue = style({
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
});

// Highlighted callout describing the reward trigger.
export const triggerCallout = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
});

// Round badge holding the trigger glyph.
export const triggerIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    flexShrink: 0,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    fontSize: "20px",
});

// Recipient pill colour accent at the top of a reward card.
export const rewardHeader = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

// Inline wrap container for tags (territories, categories, tiers).
export const tagRow = style({
    display: "flex",
    flexWrap: "wrap",
    gap: alias.spacing.xs,
});

// One tiered-reward line inside a reward card.
export const tierRow = style({
    display: "flex",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    fontVariantNumeric: "tabular-nums",
});
