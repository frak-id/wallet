import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { brand } from "@/tokens.css";

export const devices = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: brand.scale[700],
});

export const device = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
});

export const deviceIcon = style({
    height: "4rem",
    width: "4rem",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: brand.scale[200],
    backgroundColor: vars.surface.primary,
    color: vars.icon.secondary,
});

export const deviceIconSvg = style({
    height: "2rem",
    width: "2rem",
});

export const connector = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "4rem",
    position: "relative",
    "::before": {
        content: '""',
        width: "4rem",
        height: "0.125rem",
        backgroundColor: vars.border.subtle,
        position: "absolute",
        top: "50%",
        left: "0",
        transform: "translateY(-50%) translateX(-50%)",
        marginTop: "-0.7rem",
    },
});
