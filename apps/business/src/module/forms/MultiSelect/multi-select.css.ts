import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const multiSelectTrigger = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: "320px",
    minHeight: "40px",
    gap: "5px",
    padding: "0 14px !important",
});

export const multiSelectTriggerInner = style({
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
});

globalStyle(`${multiSelectTriggerInner} > span`, {
    display: "flex",
    alignItems: "center",
    height: "26px",
});

globalStyle(`${multiSelectTriggerInner} > svg`, {
    marginTop: "2px",
});

export const multiSelectActions = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "2px",
});

export const multiSelectTriggerSeparator = style({
    margin: "0 5px",
    minHeight: "20px",
});

export const multiSelectTriggerBadges = style({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: alias.spacing.xs,
});

export const multiSelectBadge = style({
    display: "inline-flex",
    gap: "3px",
    borderRadius: alias.cornerRadius.xs,
    padding: "3px 6px",
    fontSize: "12px",
    fontWeight: 500,
});

export const multiSelectSeparator = style({
    minHeight: "24px",
});

export const multiSelectButton = style({
    flex: 1,
    justifyContent: "center",
    cursor: "pointer",
});

export const multiSelectChecks = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "0.5rem",
    width: "16px",
    height: "16px",
    border: `2px solid ${brand.colors.neutral.grey400}`,
    borderRadius: "6px",
    backgroundColor: brand.colors.neutral.white,
});

export const multiSelectChecksSelected = style({
    border: `2px solid ${brand.colors.primary[500]}`,
    backgroundColor: brand.colors.primary[500],
    color: brand.colors.neutral.white,
});

export const multiSelectChecksNotSelected = style({
    background: "none",
    opacity: 0.5,
});

globalStyle(`${multiSelectChecksNotSelected} svg`, {
    visibility: "hidden",
});
