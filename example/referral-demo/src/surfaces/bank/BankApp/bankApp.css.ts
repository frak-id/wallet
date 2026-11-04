import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { deviceInset, fonts } from "@/shell/device.css";
import { helia } from "../palette";

const TAB_BAR_HEIGHT = 52;

export const screen = style({
    position: "absolute",
    inset: 0,
    background: helia.paper,
    color: helia.text,
    fontFamily: fonts.system,
    WebkitUserSelect: "none",
    userSelect: "none",
});

export const scroll = style({
    position: "absolute",
    inset: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingTop: `calc(${deviceInset.top} + 6px)`,
    paddingBottom: `calc(${deviceInset.bottom} + ${TAB_BAR_HEIGHT + 24}px)`,
    scrollbarWidth: "none",
});

export const header = style({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "4px 16px 10px",
});

export const greeting = style({
    flex: 1,
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.02em",
});

export const headerButton = style({
    position: "relative",
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: helia.surface,
    color: helia.text,
    boxShadow: `0 0 0 0.5px ${helia.hairline}`,
});

export const bellDot = style({
    position: "absolute",
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: helia.coral,
    boxShadow: `0 0 0 2px ${helia.surface}`,
});

export const card = style({
    margin: "0 16px",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    borderRadius: 24,
    color: "#fff",
    background: [
        "radial-gradient(90% 80% at 100% 0%, rgba(255, 182, 72, 0.45) 0%, rgba(255, 125, 92, 0.18) 38%, rgba(255, 125, 92, 0) 70%)",
        `linear-gradient(160deg, ${helia.inkSoft} 0%, ${helia.ink} 70%)`,
    ].join(", "),
    boxShadow: "0 14px 30px rgba(23, 20, 47, 0.22)",
});

export const cardTop = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
});

export const cardBrand = style({
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 19,
    fontWeight: 700,
    letterSpacing: "-0.03em",
});

export const cardAccount = style({
    fontSize: 13,
    fontWeight: 500,
    color: "rgba(255, 255, 255, 0.72)",
});

export const cardBalanceLabel = style({
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 22,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.66)",
});

export const creditChip = style({
    padding: "2px 8px",
    borderRadius: 999,
    background: helia.sun,
    color: helia.ink,
    fontSize: 12,
    fontWeight: 700,
});

export const cardBalance = style({
    marginTop: 2,
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    fontVariantNumeric: "tabular-nums",
});

export const cardBottom = style({
    marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.72)",
});

export const cardIban = style({
    letterSpacing: "0.06em",
    fontVariantNumeric: "tabular-nums",
});

export const actions = style({
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    padding: "14px 12px 2px",
});

export const action = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: helia.text,
});

export const actionIcon = style({
    width: 46,
    height: 46,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: helia.surface,
    color: helia.ink,
    boxShadow: `0 0 0 0.5px ${helia.hairline}, 0 2px 6px rgba(23, 20, 47, 0.05)`,
});

export const sectionHeader = style({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "14px 20px 0",
});

export const sectionTitle = style({
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.02em",
});

export const seeAll = style({
    fontSize: 15,
    fontWeight: 600,
    color: helia.coral,
});

export const group = style({
    padding: "0 16px",
});

export const groupLabel = style({
    margin: 0,
    padding: "10px 4px 6px",
    fontSize: 13,
    fontWeight: 600,
    color: helia.muted,
});

export const groupCard = style({
    overflow: "hidden",
    borderRadius: 18,
    background: helia.surface,
    boxShadow: `0 0 0 0.5px ${helia.hairline}`,
});

export const rowSlot = style({
    position: "relative",
    overflow: "hidden",
    selectors: {
        "&:not(:last-child)::after": {
            content: '""',
            position: "absolute",
            bottom: 0,
            left: 66,
            right: 0,
            height: 0.5,
            background: helia.hairline,
        },
    },
});

export const row = style({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
});

export const rowIcon = recipe({
    base: {
        flexShrink: 0,
        width: 40,
        height: 40,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        borderRadius: "50%",
        fontSize: 16,
        fontWeight: 700,
    },
    variants: {
        tone: {
            credit: { background: helia.creditSoft, color: helia.credit },
            neutral: { background: helia.neutralSoft, color: helia.inkSoft },
            logo: {},
        },
    },
});

export const rowText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
});

export const rowLabel = style({
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const rowDetail = style({
    fontSize: 13,
    color: helia.muted,
});

export const rowAmount = recipe({
    base: {
        flexShrink: 0,
        fontSize: 16,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
    },
    variants: {
        credit: {
            true: { color: helia.credit },
            false: { color: helia.text },
        },
    },
});

export const tabBar = style({
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    height: `calc(${deviceInset.bottom} + ${TAB_BAR_HEIGHT}px)`,
    paddingTop: 7,
    paddingBottom: deviceInset.bottom,
    background: "rgba(255, 255, 255, 0.94)",
    backdropFilter: "saturate(180%) blur(20px)",
    WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderTop: `0.5px solid ${helia.hairline}`,
});

export const tab = recipe({
    base: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        fontSize: 10.5,
        fontWeight: 600,
    },
    variants: {
        active: {
            true: { color: helia.ink },
            false: { color: "rgba(23, 20, 47, 0.42)" },
        },
    },
});
