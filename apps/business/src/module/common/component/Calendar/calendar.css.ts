import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const root = style({ padding: alias.spacing.s });

export const months = style({
    display: "flex",
    flexDirection: "column",
});

export const caption = style({
    display: "flex",
    position: "relative",
    paddingTop: alias.spacing.xxs,
    justifyContent: "center",
    alignItems: "center",
});

export const nav = style({
    display: "flex",
    alignItems: "center",
});

const navButtonBase = {
    all: "unset" as const,
    position: "absolute" as const,
    zIndex: 1,
    display: "flex",
    opacity: 0.5,
    cursor: "pointer",
    selectors: {
        "&:hover": { opacity: 1 },
        "&:disabled": { cursor: "not-allowed", opacity: 0.5 },
    },
};

export const navButtonPrevious = style([navButtonBase, { left: "4px" }]);

export const navButtonNext = style([navButtonBase, { right: "4px" }]);

export const table = style({
    marginTop: alias.spacing.m,
    width: "100%",
    borderCollapse: "collapse",
});

export const headRow = style({ display: "flex" });

export const headCell = style({
    fontWeight: 400,
    width: "36px",
});

export const tbody = style({ marginTop: "4px" });

export const row = style({
    display: "flex",
    marginTop: "8px",
    width: "100%",
});

export const cell = style({
    position: "relative",
    padding: 0,
    lineHeight: "20px",
    width: "36px",
    height: "36px",
});

export const day = style({
    padding: 0,
    width: "36px",
    height: "36px",
    justifyContent: "center",
    borderRadius: alias.cornerRadius.s,
    selectors: {
        "&:hover": { backgroundColor: brand.colors.neutral.grey250 },
    },
});

export const daySelected = style({
    backgroundColor: brand.colors.neutral.grey250,
    borderRadius: alias.cornerRadius.s,
});

export const dayToday = style({
    backgroundColor: brand.colors.primary[100],
    borderRadius: alias.cornerRadius.s,
});

export const dayOutside = style({ opacity: 0.5 });

export const dayDisabled = style({ opacity: 0.5 });
