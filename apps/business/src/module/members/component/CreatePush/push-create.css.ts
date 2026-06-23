import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** TextArea defaults to a bordered light surface — match the bare muted inputs. */
export const messageArea = style({
    selectors: {
        "&&": {
            border: "none",
            borderRadius: alias.cornerRadius.m,
            backgroundColor: vars.surface.muted,
        },
    },
});

export const scheduleGrid = style({
    selectors: {
        // Outrank RadioGroup's flex-column base.
        "&&": {
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: alias.spacing.m,
        },
    },
    "@media": {
        "screen and (max-width: 640px)": {
            selectors: { "&&": { gridTemplateColumns: "1fr" } },
        },
    },
});

export const scheduleCell = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    paddingBlock: alias.spacing.m,
    paddingRight: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
});

/** Matches the greyed-out radio: whole cell reads as unavailable on hover. */
export const scheduleCellDisabled = style({
    cursor: "not-allowed",
});

export const dateRow = style({
    display: "flex",
    alignItems: "flex-start",
    gap: alias.spacing.m,
});

export const dateField = style({
    flex: 1,
    minWidth: 0,
});

/** A filter group: checkbox cell stacked directly on its From/To row. */
export const audienceSection = style({
    display: "flex",
    flexDirection: "column",
});

/** Checkbox cell — its padding supplies the spacing down to the inputs. */
export const audienceCell = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
});
