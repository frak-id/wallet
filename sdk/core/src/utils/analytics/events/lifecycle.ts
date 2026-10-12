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

export type SdkLifecycleEventMap = {
    sdk_initialized: {
        sdk_version?: string;
    };
    sdk_iframe_connected: {
        handshake_duration_ms: number;
        after_timeout?: boolean;
    };
    /** The context fields are only set when `reason` is `"timeout"`. */
    sdk_iframe_handshake_failed: {
        reason: SdkHandshakeFailureReason;
    } & Partial<SdkHandshakeTimeoutContext>;
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
