/**
 * Listener miscellaneous event map — low-volume lifecycle events that don't
 * warrant their own domain file (sdk cleanup, in-app browser escape). Keeps
 * the migration away from kebab-case `trackGenericEvent` fully typed.
 */
export type InAppBrowserRedirectTarget =
    | "sd-iframe"
    | "sd-iframe-clipboard"
    | "window";

export type MergeInitiateProoflessSource =
    | "rpc"
    | "listener_modal"
    | "embedded_wallet";

/**
 * `proven` is a proven id carrying its execute-side proof; `proven_unproven` is
 * the same id with the proof missing, which the backend admits only while the
 * id has never latched. `fallback` names no proven id at all.
 */
export type MergeExecuteTargetSource =
    | "proven"
    | "proven_unproven"
    | "fallback";

export type ListenerMiscEventMap = {
    sdk_cleaned_up: undefined;
    in_app_browser_redirected: {
        target: InAppBrowserRedirectTarget;
    };
    merge_initiate_proofless: {
        source: MergeInitiateProoflessSource;
    };
    merge_execute_target_source: {
        source: MergeExecuteTargetSource;
    };
};
