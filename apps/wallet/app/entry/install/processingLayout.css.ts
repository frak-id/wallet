import { safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * The standalone processing screen: a spinner and a line of text, centred.
 * Deliberately not `PageLayout` — that component carries the wallet shell's
 * header/footer measurement machinery, none of which applies here.
 */
export const processing = style({
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: `calc(${safeArea.top} + 24px) 24px calc(${safeArea.bottom} + 24px)`,
});
