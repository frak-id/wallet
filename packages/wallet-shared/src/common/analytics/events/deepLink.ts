/**
 * Deep-link delivery telemetry — fires once per URL handed to the wallet app
 * by either the cold-start (`getCurrent()`) or warm-start (`onOpenUrl`) path
 * of `tauri-plugin-deep-link`, and once per parse failure.
 *
 * Useful for:
 *   - Measuring deep-link funnel volume + cold/warm split per action
 *   - Correlating with feature-level events (e.g. `monerium_auth_started` vs
 *     `deep_link_received { action: "monerium" }`) to detect Android delivery
 *     gaps where AOSP returns `START_TASK_TO_FRONT` and the URL never reaches
 *     the SPA at all
 *   - Quantifying the auth-gate deferral path (gated=true means the link was
 *     stored as a pending action and the user was sent to `/register`)
 */
export type DeepLinkSource = "cold_start" | "warm_start";

export type DeepLinkEventMap = {
    deep_link_received: {
        source: DeepLinkSource;
        /** Resolved action (e.g. `monerium`, `pair`, `install`) or `null` when parsing failed. */
        action: string | null;
        /** True when the action required an auth session that wasn't present. */
        gated: boolean;
    };
};
