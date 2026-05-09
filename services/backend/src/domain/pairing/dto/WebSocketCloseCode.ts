export const WsCloseCode = {
    UNAUTHORIZED: 4401,
    FORBIDDEN: 4403,
    PAIRING_NOT_FOUND: 4404,
    /**
     * The `originResumeToken` was missing, malformed, or past its 10-minute
     * expiry. The pairing it referenced is also gone (matching backend TTL),
     * so the client should drop any persisted `pairing` state and re-initiate
     * to obtain a fresh token + pairing pair.
     */
    RESUME_TOKEN_EXPIRED: 4407,
    INVALID_MSG: 4422,
    NO_CONNECTION_TO_CONNECT_TO: 4444,
};
