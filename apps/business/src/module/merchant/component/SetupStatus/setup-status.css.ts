import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const placeholder = style({
    color: "#858d9d",
    fontStyle: "italic",
    textAlign: "center",
    padding: "20px",
});

export const overallStatusSuccess = style({
    width: "100%",
    padding: "16px",
    backgroundColor: "#e0f7fa",
    borderLeft: "4px solid #0ddb84",
    borderRadius: "4px",
    marginBottom: "24px",
});

globalStyle(`${overallStatusSuccess} p`, {
    marginTop: "8px",
    color: "#333843",
    fontSize: "14px",
});

export const overallStatusWarning = style({
    width: "100%",
    padding: "16px",
    backgroundColor: brand.colors.neutral.grey200,
    borderLeft: "4px solid #ff7a00",
    borderRadius: "4px",
    marginBottom: "24px",
});

globalStyle(`${overallStatusWarning} p`, {
    marginTop: "8px",
    color: "#333843",
    fontSize: "14px",
});

export const stepItem = style({
    padding: "16px",
    borderLeft: "4px solid #e0e2e7",
    marginBottom: "24px",
    position: "relative",
    width: "100%",
});

export const header = style({
    display: "flex",
    alignItems: "center",
    marginBottom: "8px",
});

export const stepPosition = style({
    color: "#333843",
    width: "24px",
    height: "24px",
    borderColor: "#333843",
    borderRadius: "50%",
    borderStyle: "solid",
    borderWidth: "2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.bold,
    marginRight: "12px",
    flexShrink: 0,
});

export const stepName = style({
    fontSize: "18px",
    fontWeight: brand.typography.fontWeight.medium,
    display: "flex",
    alignItems: "center",
    color: "#1a1c21",
});

export const icon = style({
    color: "#0ddb84",
    marginLeft: "8px",
    flexShrink: 0,
});

export const iconWarning = style({
    color: "#ff7a00",
    marginLeft: "8px",
    flexShrink: 0,
});

export const description = style({
    margin: "8px 0 8px 36px",
    color: "#03193a",
    fontSize: "14px",
    lineHeight: 1.5,
});

export const actions = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: "16px",
    marginLeft: "36px",
    gap: "16px",
});
