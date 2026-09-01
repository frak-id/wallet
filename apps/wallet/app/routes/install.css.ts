import { alias, safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * `/install` is a top-level route, so it never enters `AppShell` and inherits
 * none of its `safeArea.top` reservation. Without this the processing screen's
 * icon sits under the status bar. The inset alone leaves it flush against the
 * bar, so add the same breather the standalone entrypoint uses
 * (`entry/install/processingLayout.css.ts`).
 */
export const safeTop = style({
    paddingTop: `calc(${safeArea.top} + ${alias.spacing.l})`,
});
