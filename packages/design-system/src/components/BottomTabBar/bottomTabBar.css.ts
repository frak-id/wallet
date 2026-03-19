import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias } from "@/tokens.css";

export const bottomTabBarStyles = {
    container: style({
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-evenly",
        alignItems: "center",
        width: "100%",
        backgroundColor: vars.surface.elevated,
        borderTop: `1px solid ${vars.border.subtle}`,
        padding: `${alias.spacing.xs} 0`,
    }),
    tab: style({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        flex: "1",
        padding: `${alias.spacing.xs} 0`,
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
    }),
    tabLabel: style({
        fontSize: "11px",
        color: vars.text.tertiary,
        fontWeight: 400,
    }),
    tabLabelActive: style({
        fontSize: "11px",
        color: vars.text.action,
        fontWeight: 700,
    }),
    tabIconWrapper: style({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${alias.spacing.xs} ${alias.spacing.s}`,
        borderRadius: alias.cornerRadius.xl,
        color: vars.icon.tertiary,
    }),
    tabIconWrapperActive: style({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${alias.spacing.xs} ${alias.spacing.s}`,
        borderRadius: alias.cornerRadius.xl,
        backgroundColor: vars.surface.secondary,
        color: vars.icon.action,
    }),
};
