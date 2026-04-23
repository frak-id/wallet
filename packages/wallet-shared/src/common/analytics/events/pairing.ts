/**
 * Pairing request event map — instrumentation for the `_protected/pairing.tsx`
 * route (merchant-initiated device pairing approval). The pre-existing
 * `pairing_initiated` / `pairing_completed` pair lives in `AuthEventMap`
 * because pairing is an auth type; this map covers the view-level funnel.
 */
export type PairingErrorState = "not_found" | "transient";
export type PairingMode = "qr" | "code" | "deep_link";

type PairingBaseProps = {
    mode?: PairingMode;
};

export type PairingEventMap = {
    pairing_request_viewed: PairingBaseProps & {
        has_id: boolean;
    };
    pairing_request_no_id: undefined;
    pairing_request_error: PairingBaseProps & {
        error_state: PairingErrorState;
    };
    pairing_request_refreshed: PairingBaseProps | undefined;
    pairing_request_confirmed: PairingBaseProps & {
        duration_ms: number;
    };
    pairing_request_cancelled: PairingBaseProps & {
        duration_ms: number;
    };
};
