import { style } from "@vanilla-extract/css";

/**
 * Lets the page fill the AppShell `mainContent` height so we can push the
 * Send button to the bottom of the viewport (above the bottom tab bar)
 * via `flexGrow: 1` on a spacer — same chrome as the Monerium screens'
 * sticky footer, adapted for the in-shell layout.
 */
export const pageContainer = style({
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
});
