/**
 * When a pairing is initiated by the origin
 */
export type WsPairingCreatedResponse = {
    type: "pairing-initiated";
    payload: {
        pairingId: string;
        pairingCode: string;
    };
};

/**
 * When the origin send a ping request
 *  from origin
 */
export type WsPingRequest = {
    type: "ping";
};

/**
 * When the origin want to send a webauthn request
 *  from origin
 */
export type WsWebAuthnRequest = {
    type: "webauthn-request";
    payload: {
        request: string;
    };
};

/**
 * When the target want to send a pong response
 *  from target
 */
export type WsPongRequest = {
    type: "pong";
    payload: {
        pairingId: string;
    };
};

/**
 * When the target want to send a webauthn response
 *  from target
 */
export type WsWebAuthnResponseRequest = {
    type: "webauthn-response";
    payload: {
        pairingId: string;
        response: string;
    };
};

export type WsDirectMessageResponse = WsPairingCreatedResponse;

export type WsRequestDirectMessage =
    | WsPingRequest
    | WsPongRequest
    | WsWebAuthnRequest
    | WsWebAuthnResponseRequest;
