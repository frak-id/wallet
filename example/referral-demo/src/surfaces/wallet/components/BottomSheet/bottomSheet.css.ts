import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { deviceInset, fonts } from "@/shell/device.css";

export const backdrop = recipe({
    base: {
        position: "absolute",
        inset: 0,
        zIndex: 30,
    },
    variants: {
        look: {
            system: { background: "rgba(0, 0, 0, 0.32)" },
            frak: { background: "rgba(0, 0, 0, 0.7)" },
            store: { background: "rgba(0, 0, 0, 0.36)" },
        },
    },
});

export const sheet = recipe({
    base: {
        position: "absolute",
        zIndex: 31,
        display: "flex",
        flexDirection: "column",
    },
    variants: {
        look: {
            system: {
                left: 8,
                right: 8,
                bottom: 8,
                padding: "22px 22px 20px",
                paddingBottom: `max(20px, calc(${deviceInset.bottom} - 6px))`,
                borderRadius: 38,
                background: "rgba(248, 248, 250, 0.97)",
                backdropFilter: "saturate(180%) blur(30px)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
                fontFamily: fonts.system,
                color: "#000",
            },
            frak: {
                left: alias.spacing.m,
                right: alias.spacing.m,
                bottom: `max(${alias.spacing.m}, ${deviceInset.bottom})`,
                padding: `${alias.spacing.m} ${alias.spacing.m} ${alias.spacing.l}`,
                borderRadius: alias.cornerRadius.xl,
                background: vars.surface.elevated,
                fontFamily: fonts.inter,
            },
            store: {
                top: `calc(${deviceInset.top} + 10px)`,
                left: 0,
                right: 0,
                bottom: 0,
                overflow: "hidden",
                borderRadius: "12px 12px 0 0",
                background: "#fff",
                fontFamily: fonts.system,
                color: "#000",
            },
        },
    },
});

export const handle = style({
    flexShrink: 0,
    margin: `0 auto ${alias.spacing.m}`,
    height: 8,
    width: 100,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.border.default,
});
