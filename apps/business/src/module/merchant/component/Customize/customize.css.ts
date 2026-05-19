import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

const tabBase = {
    all: "unset",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    cursor: "pointer",
    padding: "6px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.medium,
    backgroundColor: "#f9f9fc",
    border: "1px solid #e0e2e7",
    transition: "all 0.2s",
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.5,
        },
    },
} as const;

export const customizeTab = style(tabBase);

export const customizeTabAdd = style(tabBase);

export const customizeTabActive = style({
    backgroundColor: "#5c59e8",
    color: brand.colors.neutral.white,
    borderColor: "#5c59e8",
});

export const customizeOverflow = style({
    position: "relative",
});

export const customizeOverflowMenu = style({
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    zIndex: 10,
    minWidth: "180px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "6px",
    borderRadius: "8px",
    border: "1px solid #e0e2e7",
    background: "#f9f9fc",
    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.12)",
});

export const customizeOverflowItem = style({
    all: "unset",
    cursor: "pointer",
    padding: "8px 10px",
    borderRadius: "6px",
    color: brand.colors.neutral.white,
    fontSize: "14px",
    selectors: {
        "&:hover": {
            background: "color-mix(in srgb, #5c59e8 12%, transparent)",
        },
    },
});

export const customizeCreateDialogBody = style({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
});

export const customizeTextarea = style({
    all: "unset",
    boxSizing: "border-box",
    padding: "9px 12px",
    width: "100%",
    minHeight: "220px",
    lineHeight: "20px",
    fontSize: "14px",
    color: "#333843",
    fontWeight: brand.typography.fontWeight.regular,
    border: "1px solid #e0e2e7",
    borderRadius: "8px",
    backgroundColor: "#f9f9fc",
    transition: "border-color 0.2s",
    resize: "vertical",
    fontFamily: '"Fira Mono", "SF Mono", Menlo, Consolas, monospace',
    selectors: {
        "&:focus": {
            boxShadow: "0 0 0 1px #5c59e8",
        },
    },
});

export const customizeSelect = style({
    all: "unset",
    boxSizing: "border-box",
    padding: "9px 12px",
    width: "320px",
    lineHeight: "20px",
    fontSize: "16px",
    color: "#333843",
    fontWeight: brand.typography.fontWeight.regular,
    border: "1px solid #e0e2e7",
    borderRadius: "8px",
    backgroundColor: "#f9f9fc",
    transition: "border-color 0.2s",
    appearance: "auto",
    selectors: {
        "&:focus": {
            boxShadow: "0 0 0 1px #5c59e8",
        },
    },
});

globalStyle(`${customizeTextarea}::placeholder`, {
    color: "#858d9d",
    opacity: 1,
});

export const customizeComponentSelector = style({
    display: "flex",
    gap: "8px",
    margin: "16px 0",
    flexWrap: "wrap",
});

export const customizeSettingsGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px 16px",
});

export const customizeSwitchRow = style({
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    paddingTop: "28px",
});

globalStyle(`${customizeSwitchRow} > p`, {
    flexBasis: "100%",
    order: 1,
});

export const customizeTranslationLangTabs = style({
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    flexWrap: "wrap",
});

export const customizeTranslationLangTab = style({
    all: "unset",
    cursor: "pointer",
    padding: "6px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.medium,
    backgroundColor: "#f9f9fc",
    border: "1px solid #e0e2e7",
    transition: "all 0.2s",
});

export const customizeTranslationLangTabActive = style({
    backgroundColor: "#5c59e8",
    color: brand.colors.neutral.white,
    borderColor: "#5c59e8",
});

export const customizeTranslationGroup = style({
    border: "1px solid #e0e2e7",
    borderRadius: "10px",
    marginBottom: "12px",
    overflow: "hidden",
});

export const customizeTranslationGroupHeader = style({
    all: "unset",
    boxSizing: "border-box",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.semiBold,
    background: "color-mix(in srgb, #f9f9fc 88%, #5c59e8 12%)",
});

export const customizeTranslationGroupBody = style({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
});

export const customizeTranslationRow = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
});

export const customizeTranslationLabel = style({
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.semiBold,
});

export const customizeTranslationKeyMuted = style({
    margin: 0,
    fontSize: "11px",
    fontFamily: '"Fira Mono", "SF Mono", Menlo, Consolas, monospace',
    color: "#858d9d",
    lineHeight: 1,
});

export const customizeFieldDescription = style({
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.4,
    color: "#858d9d",
});

export const customizeAdvancedSection = style({
    marginTop: "16px",
});

export const customizeAdvancedToggle = style({
    all: "unset",
    boxSizing: "border-box",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.semiBold,
    borderRadius: "10px",
    border: "1px dashed #e0e2e7",
    color: "#858d9d",
    transition: "all 0.2s",
    selectors: {
        "&:hover": {
            borderColor: "#5c59e8",
            color: brand.colors.neutral.white,
        },
    },
});

export const customizeAdvancedBody = style({
    marginTop: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
});

export const customizeHint = style({
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.4,
});

export const customizeDeleteButton = style({
    all: "unset",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #f79ea9",
    color: "#d11a2a",
    background: "#fff5f6",
    fontWeight: brand.typography.fontWeight.semiBold,
    selectors: {
        "&:hover": {
            borderColor: "#df4151",
            background: "#ffecee",
        },
    },
});
