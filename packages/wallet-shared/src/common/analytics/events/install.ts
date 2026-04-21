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
    | "stored";

export type InstallStore = "app_store" | "play_store";

export type InstallReferrerMissingReason = "empty" | "missing_params";

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
        view: InstallPageView;
    };
    install_processing_started: {
        is_logged_in: boolean;
        has_ensure_action: boolean;
    };
    install_code_displayed: MerchantMaybe;
    install_code_generation_failed: MerchantMaybe & {
        error_type: string;
    };
    install_code_copied: MerchantMaybe;
    install_store_clicked: MerchantMaybe & {
        store: InstallStore;
        has_referrer: boolean;
    };
    install_page_dismissed: undefined;

    // PWA "Add to Home Screen" — separate from the mobile-app retrieval flow
    // but kept here to keep every install-themed event under one domain.
    install_pwa_initiated: undefined;

    // ---------------------------------------------------------------------
    // Android Play Install Referrer (passive attribution)
    // ---------------------------------------------------------------------
    install_referrer_checked: undefined;
    install_referrer_resolved: {
        has_merchant: boolean;
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
    };
    install_code_resolve_failed: {
        error_code: string;
    };
    install_code_success_modal_viewed: MerchantMaybe;

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
    };
};
