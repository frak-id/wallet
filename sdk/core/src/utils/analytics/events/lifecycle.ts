export type SdkHandshakeFailureReason = "timeout" | "origin" | "unknown";

export type SdkLifecycleEventMap = {
    sdk_initialized: {
        sdkVersion?: string;
    };
    sdk_iframe_connected: {
        handshake_duration_ms: number;
    };
    sdk_iframe_handshake_failed: {
        reason: SdkHandshakeFailureReason;
    };
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
