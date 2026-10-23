export type SdkHandshakeFailureReason = "timeout" | "asset_push" | "unknown";

/** Page and listener state when the handshake timed out. */
export type SdkHandshakeTimeoutContext = {
    visibility_state: DocumentVisibilityState;
    was_hidden: boolean;
    online: boolean;
    /** Absent when the caller built its own iframe. */
    listener_seen?: boolean;
    listener_error?: string;
    iframe_load_ms?: number;
};

/** The wallet iframe connected, but pushing one of the partner's assets to it failed. */
export type SdkAssetPushContext = {
    asset: "css" | "i18n" | "backup";
    error_name: string;
    error_message: string;
};

export type SdkLifecycleEventMap = {
    sdk_initialized: {
        sdk_version?: string;
    };
    sdk_iframe_connected: {
        handshake_duration_ms: number;
        after_timeout?: boolean;
    };
    sdk_iframe_handshake_failed:
        | ({ reason: "timeout" } & SdkHandshakeTimeoutContext)
        | ({ reason: "asset_push" } & SdkAssetPushContext)
        | { reason: "unknown" };
    /**
     * Emitted by the CDN bootstrap when `initFrakSdk()` throws before a
     * client is available. Uses a transient OpenPanel instance so broken
     * partner integrations are still captured.
     */
    sdk_init_failed: {
        reason: string;
        config_missing?: boolean;
    };
};
