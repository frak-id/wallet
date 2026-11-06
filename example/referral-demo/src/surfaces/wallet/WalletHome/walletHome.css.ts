import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { deviceInset, fonts } from "@/shell/device.css";
import { bottomBarHeight } from "./BottomTabBar/bottomTabBar.css";

const contentTop = `calc(${deviceInset.top} + ${alias.spacing.m})`;

export const screen = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: vars.surface.background2,
    color: vars.text.primary,
    fontFamily: fonts.inter,
});

export const scroller = style({
    position: "absolute",
    inset: 0,
    overflowY: "auto",
    overscrollBehaviorY: "contain",
    paddingTop: contentTop,
    paddingInline: alias.spacing.m,
    paddingBottom: `calc(${bottomBarHeight} + ${deviceInset.bottom} + ${alias.spacing.m})`,
});

export const statusBarScrim = style({
    position: "absolute",
    zIndex: 5,
    top: 0,
    left: 0,
    right: 0,
    height: contentTop,
    background: vars.surface.background2,
    maskImage: "linear-gradient(to bottom, #000 50%, transparent)",
    pointerEvents: "none",
});

export const pageTitle = style({
    margin: 0,
});
