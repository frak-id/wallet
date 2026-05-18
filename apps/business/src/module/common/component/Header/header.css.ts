import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { brandColors } from "@/styles/brand";

export const header = style({
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    flexDirection: "column",
    gap: "8px",
    position: "fixed",
    zIndex: 1,
    width: "100%",
    height: "72px",
    padding: "16px 24px",
    background: brandColors.blur,
    backdropFilter: "blur(10px)",
});

export const headerLogo = style({
    position: "absolute",
    marginTop: "-18px",
    top: "50%",
    left: "28px",
    color: "white",
});

export const navigationTopContainer = style({
    display: "flex",
    alignItems: "center",
    gap: "24px",
});

export const navigationTopList = style({
    display: "flex",
    gap: "40px",
    "@media": {
        "screen and (max-width: 768px)": {
            display: "none",
        },
    },
});

export const navigationTopItemButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "flex",
    cursor: "pointer",
});

export const navigationProfile = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    "::before": {
        content: '""',
        width: "1px",
        height: "40px",
        background: brand.colors.neutral.white,
    },
    "@media": {
        "screen and (max-width: 768px)": {
            "::before": {
                display: "none",
            },
        },
    },
});

export const navigationProfileAvatar = style({
    display: "block",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "1px solid white",
    textAlign: "center",
});

globalStyle(`${navigationProfileAvatar} > svg`, {
    marginTop: "3px",
    marginLeft: "1px",
});

export const navigationProfileInfos = style({
    display: "flex",
    flexDirection: "column",
    gap: "2px",
});

globalStyle(`${navigationProfileInfos} > span:last-child`, {
    fontSize: "12px",
});

export const demoModeBadge = style({
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    color: "#93c5fd",
    border: "1px solid rgba(147, 197, 253, 0.3)",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.5px",
    cursor: "pointer",
    textTransform: "lowercase",
});
