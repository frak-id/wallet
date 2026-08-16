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

export type MergeExecuteTargetSource = "proven" | "fallback";

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
