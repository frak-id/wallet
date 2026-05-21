import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const formGoalsLabel = style({
    display: "flex !important" as "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    cursor: "pointer",
});

export const formGoalsLabelDisabled = style({
    display: "flex !important" as "flex",
    alignItems: "center",
    color: "#818c9c", // TODO: token
    gap: alias.spacing.xs,
});

export const formGoalsBadges = style({
    display: "flex",
    alignItems: "flex-start",
    flexDirection: "column",
    gap: "10px",
    marginTop: "10px",
});

export const formGoalsInformationWrapper = style({
    maxWidth: "428px",
    marginLeft: "auto",
});

export const formGoalsInformation = style({
    padding: alias.spacing.m,
    color: "#667085", // TODO: token
});

export const formGoalsInformationAwareness = style({
    background: "#fdf1e8", // TODO: token
});

export const formGoalsInformationTraffic = style({
    background: "#d8e1ff", // TODO: token
});

export const formGoalsInformationRegistration = style({
    background: "#e8fde9", // TODO: token
});

export const formGoalsInformationSales = style({
    background: "#fde8eb", // TODO: token
});

export const formGoalsInformationRetention = style({
    background: "#fdfce8", // TODO: token
});

export const formGoalsInformationByGoal: Record<string, string> = {
    awareness: formGoalsInformationAwareness,
    traffic: formGoalsInformationTraffic,
    registration: formGoalsInformationRegistration,
    sales: formGoalsInformationSales,
    retention: formGoalsInformationRetention,
};

export const formGoalsTitle = style({
    color: "#333843", // TODO: token
    fontSize: "16px",
    fontWeight: brand.typography.fontWeight.medium,
});

export const formGoalsWarning = style({
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    marginTop: alias.spacing.m,
    background: "#fff3cd", // TODO: token
    border: "1px solid #ffc107",
    borderRadius: alias.cornerRadius.s,
    color: "#856404", // TODO: token
    fontSize: "14px",
    lineHeight: 1.5,
});

globalStyle(`${formGoalsWarning} svg`, {
    flexShrink: 0,
    marginTop: "2px",
});
