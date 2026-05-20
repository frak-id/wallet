import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const pushPreview = style({
    position: "relative",
    display: "inline-block",
});

export const pushPreviewNotificationWrapper = style({
    position: "absolute",
    top: "200px",
    left: 0,
    width: "100%",
});

export const pushPreviewNotification = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: "0 23px",
    background: "#f5f5f54d",
    color: brand.colors.neutral.white,
    padding: "10px",
    borderRadius: "18px",
    fontSize: "11px",
    letterSpacing: "-0.20000000298023224px",
});

export const pushPreviewTitle = style({
    fontSize: "13px",
    fontWeight: brand.typography.fontWeight.semiBold,
    letterSpacing: "-0.02em",
});

export const pushPreviewText = style({
    fontFamily: "inherit",
    whiteSpace: "pre-wrap",
});

export const pushPreviewDate = style({
    position: "absolute",
    top: "12px",
    right: "12px",
    fontSize: "9px",
    letterSpacing: "-0.20000000298023224px",
    textAlign: "right",
    color: "#d7d7d7",
});

export const pushPreviewIcon = style({
    width: "29px",
    height: "29px",
    borderRadius: "10px",
    background: brand.colors.neutral.white,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
});
