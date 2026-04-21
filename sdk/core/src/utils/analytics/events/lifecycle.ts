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
    sdk_iframe_heartbeat_timeout: undefined;
};
