/**
 * When the origin send the request to the target
 */
export type WsWebAuthnRequest = {
    type: "webauthn-request";
    payload: {
        // compressed request (b64 encoded of an AuthenticationRequestJSON)
        id: string;
        request: string;
        // Some optional context
        context?: object;
    };
};

/**
 * When the target send back the response to the origin
 */
export type WsWebAuthnResponse = {
    type: "webauthn-response";
    payload: {
        // compressed response (b64 encoded of an AuthenticationResponseJSON)
        id: string;
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
