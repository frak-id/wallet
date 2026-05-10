/**
 * Deep-link delivery telemetry — fires once per URL handed to the wallet app
 * by `tauri-plugin-deep-link`, after the URL has been parsed into a known
 * action.
 *
 * Used as the canonical KPI for native-app entry points:
 *   - `source`  cold (app launched by the link) vs warm (app already running)
 *   - `action`  which action the user landed on (`monerium`, `pair`, `install`,
 *               `send`, `notifications`, …)
 *   - `gated`   true when the action required a session and one wasn't present,
 *               i.e. the link was deferred behind `/register`
 */
export type DeepLinkSource = "cold_start" | "warm_start";

export type DeepLinkEventMap = {
    deep_link_received: {
        source: DeepLinkSource;
        action: string;
        gated: boolean;
    };
};
