import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { deviceInset, fonts, iosColors } from "@/shell/device.css";

const ios = {
    label: iosColors.label,
    secondary: iosColors.secondaryLabel,
    separator: iosColors.separator,
    blue: iosColors.blue,
};

export const root = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    fontFamily: fonts.system,
    WebkitFontSmoothing: "antialiased",
});

/** The page's own sticky header and footer stack inside this layer, under the sheet. */
export const page = style({
    position: "absolute",
    inset: 0,
    isolation: "isolate",
    zIndex: 0,
});

export const backdrop = style({
    position: "absolute",
    zIndex: 1,
    inset: 0,
    background: "rgba(0, 0, 0, 0.28)",
});

export const sheet = style({
    position: "absolute",
    top: "max(15%, 64px)",
    left: 6,
    right: 6,
    bottom: 6,
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    borderRadius: 34,
    overflow: "hidden",
    background: "#f2f2f7",
    boxShadow:
        "0 -2px 30px rgba(0, 0, 0, 0.12), inset 0 0.5px 0 rgba(255, 255, 255, 0.8)",
    transformOrigin: "50% 100%",
});

export const grabber = style({
    alignSelf: "center",
    flexShrink: 0,
    width: 36,
    height: 5,
    marginTop: 6,
    borderRadius: 3,
    background: "rgba(60, 60, 67, 0.3)",
});

export const preview = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px 14px 18px",
    borderBottom: `0.5px solid ${ios.separator}`,
});

export const previewThumb = style({
    flexShrink: 0,
    width: 52,
    height: 52,
    borderRadius: 11,
    overflow: "hidden",
    boxShadow: "0 0 0 0.5px rgba(0, 0, 0, 0.1)",
});

export const previewText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
});

export const previewTitle = style({
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.25,
    color: ios.label,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const previewDomain = style({
    fontSize: 13,
    color: ios.secondary,
    lineHeight: 1.3,
});

export const previewOptions = style({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    alignSelf: "flex-start",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    color: ios.label,
    background: "rgba(120, 120, 128, 0.14)",
});

export const closeButton = style({
    flexShrink: 0,
    alignSelf: "flex-start",
    width: 32,
    height: 32,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    color: "rgba(60, 60, 67, 0.75)",
    background: "rgba(120, 120, 128, 0.16)",
});

export const scroll = style({
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingBottom: 16,
});

export const row = style({
    display: "flex",
    gap: 4,
    padding: "16px 10px 12px",
    overflowX: "auto",
    scrollbarWidth: "none",
    borderBottom: `0.5px solid ${ios.separator}`,
    selectors: {
        "&::-webkit-scrollbar": { display: "none" },
    },
});

export const person = style({
    flexShrink: 0,
    width: 78,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
});

export const personAvatar = style({
    position: "relative",
    width: 64,
    height: 64,
});

export const personBadge = style({
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    display: "grid",
    filter: "drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.18))",
});

export const personName = style({
    maxWidth: "100%",
    fontSize: 11.5,
    lineHeight: 1.2,
    color: ios.label,
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const app = style({
    flexShrink: 0,
    width: 78,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition: "transform 140ms ease",
    selectors: {
        "&:active": { transform: "scale(0.92)" },
    },
});

export const appIcon = style({
    position: "relative",
    width: 60,
    height: 60,
    display: "grid",
    filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.08))",
});

const hintPulse = keyframes({
    "0%": { transform: "scale(1)", opacity: 0.85 },
    "75%, 100%": { transform: "scale(1.28)", opacity: 0 },
});

const hintNudge = keyframes({
    "0%, 60%, 100%": { transform: "scale(1)" },
    "20%": { transform: "scale(1.07)" },
});

export const appIconHinted = style({
    animation: `${hintNudge} 1.6s ease-in-out infinite`,
});

export const appHint = style({
    position: "absolute",
    inset: 0,
    borderRadius: 18,
    boxShadow: "0 0 0 3px #d6249f",
    animation: `${hintPulse} 1.6s cubic-bezier(0.2, 0.7, 0.3, 1) infinite`,
    pointerEvents: "none",
});

export const appLabel = style({
    fontSize: 11.5,
    lineHeight: 1.2,
    color: ios.label,
    whiteSpace: "nowrap",
});

export const actions = style({
    margin: "16px 16px 0",
    padding: 0,
    listStyle: "none",
    borderRadius: 22,
    overflow: "hidden",
    background: "rgba(255, 255, 255, 0.92)",
});

export const action = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 50,
    padding: "0 18px",
    fontSize: 17,
    letterSpacing: "-0.02em",
    color: ios.label,
    boxShadow: `inset 0 -0.5px 0 ${ios.separator}`,
    selectors: {
        "&:last-child": { boxShadow: "none" },
    },
});

export const editActions = style({
    display: "block",
    padding: "14px 34px 0",
    fontSize: 17,
    letterSpacing: "-0.02em",
    color: ios.blue,
});

export const chooserBackdrop = style({
    position: "absolute",
    zIndex: 3,
    inset: 0,
    border: "none",
    padding: 0,
    background: "rgba(0, 0, 0, 0.3)",
    cursor: "default",
});

export const chooser = style({
    position: "absolute",
    zIndex: 4,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    padding: "6px 0 14px",
    paddingBottom: `calc(${deviceInset.bottom} + 14px)`,
    borderRadius: "18px 18px 0 0",
    background: "#fff",
    boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.12)",
});

export const chooserGrabber = style({
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    background: "#dbdbdb",
});

export const chooserHeader = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "14px 16px 12px",
    borderBottom: "0.5px solid #dbdbdb",
});

export const chooserTitle = style({
    fontSize: 16,
    fontWeight: 700,
    color: "#000",
});

const rowPulse = keyframes({
    "0%, 100%": { backgroundColor: "rgba(0, 149, 246, 0)" },
    "50%": { backgroundColor: "rgba(0, 149, 246, 0.1)" },
});

export const chooserRow = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        minHeight: 64,
        padding: "10px 16px",
        border: "none",
        background: "none",
        font: "inherit",
        color: "#000",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
        selectors: {
            "&:active": { backgroundColor: "#efefef" },
        },
    },
    variants: {
        hint: {
            true: {
                cursor: "pointer",
                animation: `${rowPulse} 1.6s ease-in-out infinite`,
            },
            false: {},
        },
    },
});

export const chooserStoryAvatar = style({
    position: "relative",
    flexShrink: 0,
    width: 44,
    height: 44,
});

export const chooserPlus = style({
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    color: "#fff",
    background: "#0095f6",
    border: "2px solid #fff",
});

export const chooserGlyph = style({
    flexShrink: 0,
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#efefef",
    color: "#000",
});

export const chooserText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
});

export const chooserLabel = style({
    fontSize: 15,
    fontWeight: 600,
});

export const chooserHint = style({
    fontSize: 13,
    color: "#737373",
});

export const chooserChevron = style({
    flexShrink: 0,
    color: "#737373",
});
