import { style } from "@vanilla-extract/css";
import { deviceInset, fonts } from "@/shell/device.css";

export const appScreen = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: "#fff",
});

export const heading = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    textAlign: "center",
    color: "#fff",
});

export const overline = style({
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.6)",
});

export const title = style({
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 700,
    letterSpacing: "-0.03em",
});

export const lede = style({
    maxWidth: 460,
    fontSize: 15,
    lineHeight: 1.5,
    color: "rgba(255, 255, 255, 0.72)",
});

export const screen = style({
    position: "absolute",
    inset: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    padding: "0 16px",
    paddingTop: `calc(${deviceInset.top} + 20px)`,
    paddingBottom: `calc(${deviceInset.bottom} + 20px)`,
    fontFamily: fonts.inter,
    background: [
        "radial-gradient(120% 60% at 50% 0%, rgba(51, 105, 242, 0.4), transparent 60%)",
        "#060b1f",
    ].join(", "),
});

export const phonesRow = style({
    display: "flex",
    gap: 10,
});

export const miniColumn = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
});

export const miniPhone = style({
    width: "100%",
    aspectRatio: "426 / 898",
});

export const phoneCaption = style({
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
});

export const earned = style({
    padding: "3px 9px",
    borderRadius: 999,
    background: "rgba(107, 216, 164, 0.18)",
    color: "#6bd8a4",
    fontSize: 13,
    fontWeight: 700,
});

export const summary = style({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    background: "rgba(255, 255, 255, 0.06)",
    color: "#fff",
});

export const summaryTitle = style({
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.6)",
});

export const summaryRow = style({
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    fontSize: 15,
});

export const summaryFootnote = style({
    fontSize: 12,
    color: "#6bd8a4",
});

export const replay = style({
    alignSelf: "center",
    padding: "12px 20px",
    border: 0,
    borderRadius: 999,
    background: "#fff",
    color: "#060b1f",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
});

export const desk = style({
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 20,
});

export const deskRow = style({
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 28,
});

export const deskColumn = style({
    flex: "0 1 440px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
});

export const deskPhone = style({
    flex: 1,
    minHeight: 0,
    width: "100%",
});

export const deskCenter = style({
    flex: "0 0 260px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 20,
});
