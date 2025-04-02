/**
 * When the origin send the request to the target
 */
export type WsWebAuthnRequest = {
    type: "webauthn-request";
    payload: {
        // compressed request (b64 encoded of an AuthenticationRequestJSON)
        request: string;
    };
};

/**
 * When the target send back the response to the origin
 */
export type WsWebAuthnResponse = {
    type: "webauthn-response";
    payload: {
        // compressed response (b64 encoded of an AuthenticationResponseJSON)
        response: string;
    };
};

/**
 * Ping pong between the origin and the target
 *  - origin send `ping`
 *  - target send `pong`
 */
export type WsPingPong = {
    type: "ping" | "pong";
};

export type WsTopicMessage =
    | WsWebAuthnRequest
    | WsWebAuthnResponse
    | WsPingPong;
