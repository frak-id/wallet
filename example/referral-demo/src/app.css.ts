import { globalStyle, style } from "@vanilla-extract/css";
import { fonts } from "@/shell/device.css";

globalStyle("html, body, #root", {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    overscrollBehavior: "none",
});

globalStyle("body", {
    background: "#060b1f",
    fontFamily: fonts.inter,
    WebkitFontSmoothing: "antialiased",
    WebkitTapHighlightColor: "transparent",
    WebkitUserSelect: "none",
    userSelect: "none",
    touchAction: "manipulation",
});

globalStyle("button", {
    font: "inherit",
});

export const desk = style({
    display: "flex",
    height: "100%",
    background: [
        "radial-gradient(1200px 700px at 30% 20%, rgba(51, 105, 242, 0.22), transparent 60%)",
        "radial-gradient(900px 600px at 70% 90%, rgba(180, 83, 42, 0.12), transparent 60%)",
        "#060b1f",
    ].join(", "),
});

export const deskMain = style({
    position: "relative",
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px 24px 28px",
    gap: 14,
});

export const phoneSlot = style({
    flex: 1,
    minHeight: 0,
    width: "100%",
});

export const caption = style({
    height: 32,
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#fff",
    fontSize: 14,
});

export const captionName = style({
    fontWeight: 600,
});

export const captionRole = style({
    padding: "3px 10px",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.1)",
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    fontWeight: 500,
});
