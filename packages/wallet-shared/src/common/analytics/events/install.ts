/**
 * Install attribution event map — mobile app retrieval funnel.
 *
 * Three mechanisms feed the same `identity_ensure_*` outcome:
 *   - `/install` page → store click → later magic-code / referrer resolve
 *   - Android Play Install Referrer (passive, zero-friction)
 *   - User-entered magic code (iOS + non-Chrome Android)
 *
 * No `flow_id` on these events — attribution is distributed across devices
 * (web browser → Store → mobile app). Stitching happens server-side via the
 * shared `merchantId` + `anonymousId` tuple or the install code itself.
 */
export type InstallSource =
    | "url_params"
    | "install_referrer"
    | "install_code"
    | "inapp_redirect"
    | "stored";

export type InstallStore = "app_store" | "play_store";

export type InstallReferrerMissingReason = "empty" | "missing_params";

export type InstallProbeSurface = "overlay" | "product";

export type InstallProbeUnavailableReason = "disabled" | "undeclared";

export type InstallPageView = "code" | "processing";

type MerchantMaybe = {
    merchant_id?: string;
};

export type InstallEventMap = {
    // ---------------------------------------------------------------------
    // /install page (web-side gateway)
    // ---------------------------------------------------------------------
    install_page_viewed: MerchantMaybe & {
        has_anonymous_id: boolean;
        // Gate 2's order-derived credential. Sizes the Shopify share of this
        // surface, and the loss on the processing branch that drops it.
        has_checkout_token: boolean;
        // Whether the `#p=` install-proof fragment survived the redirect
        // chain that led here. Purely diagnostic — attribution never
        // depends on this being true.
        has_install_proof: boolean;
        view: InstallPageView;
    };
    // Fire-and-forget — no `_succeeded/_failed` outcome is tracked at this level;
    // the ensuing `identity_ensure_*` events own the funnel terminal state.
    install_processing_triggered: {
        is_logged_in: boolean;
        has_ensure_action: boolean;
        // This branch cannot resolve a token to an id, so a true value here is
        // an attribution loss rather than a credential.
        has_checkout_token: boolean;
        has_install_proof: boolean;
    };
    install_code_displayed: MerchantMaybe;
    install_code_generation_failed: MerchantMaybe & {
        error_type: string;
    };
    install_code_copied: MerchantMaybe & {
        // Whether a native host took the code. Its own write supersedes the
        // page's, so a true value here means the clipboard entry carries an
        // expiry and is marked sensitive.
        handed_off: boolean;
    };
    install_store_clicked: MerchantMaybe & {
        store: InstallStore;
        has_referrer: boolean;
        // Play referrer only — whether the referrer string being launched
        // carries a frak-install-v1 proof alongside the legacy
        // merchantId/anonymousId pair.
        has_referrer_proof: boolean;
    };
    install_page_dismissed: undefined;

    // iOS post-install detection. Sourced from the SDK's fragment rewrite
    // (`dt`/`via`/`probe`); neither native SDK has an analytics sink of its own.
    install_detected: MerchantMaybe & {
        elapsed_ms: number;
        surface: InstallProbeSurface;
    };
    install_probe_unavailable: MerchantMaybe & {
        reason: InstallProbeUnavailableReason;
    };
    install_open_wallet_clicked: MerchantMaybe;

    // PWA "Add to Home Screen" — separate from the mobile-app retrieval flow
    // but kept here to keep every install-themed event under one domain.
    install_pwa_initiated: undefined;

    // ---------------------------------------------------------------------
    // Android Play Install Referrer (passive attribution)
    // ---------------------------------------------------------------------
    install_referrer_checked: undefined;
    install_referrer_resolved: {
        has_merchant: boolean;
        has_referrer_proof: boolean;
    };
    install_referrer_missing: {
        reason: InstallReferrerMissingReason;
    };
    install_referrer_failed: {
        error_type: string;
    };

    // ---------------------------------------------------------------------
    // Magic install code (user-entered fallback)
    // ---------------------------------------------------------------------
    install_code_page_viewed: undefined;
    install_code_submitted: undefined;
    install_code_resolved: {
        has_wallet: boolean;
        merchant_domain: string;
        /** `UNRESOLVED` means the code was valid but named no identity. */
        outcome: "RESOLVED" | "UNRESOLVED";
    };
    install_code_resolve_failed: {
        error_code: string;
    };

    // ---------------------------------------------------------------------
    // Ensure outcome (cross-cutting — all three mechanisms converge here)
    // ---------------------------------------------------------------------
    identity_ensure_executed: {
        source: InstallSource;
    };
    identity_ensure_succeeded: {
        source: InstallSource;
        duration_ms: number;
    };
    identity_ensure_failed: {
        source: InstallSource;
        error_type: string;
        // True for a stable WALLET_ALREADY_LINKED conflict — the anonymous
        // id is already linked to a different wallet, so the action is
        // dropped instead of retried on every future launch. Only the
        // pending-actions ensure path currently sets it.
        non_retryable?: boolean;
    };
};
