export type PairingRole = "origin" | "target";

// Backend message types
export type WsMessage =
    // Responses from server
    | {
          type: "pairing-initiated";
          payload: { pairingId: string; pairingCode: string };
      }
    // Requests from clients
    | { type: "ping" }
    | { type: "pong"; payload: { pairingId: string } }
    | {
          type: "webauthn-request";
          payload: { id: string; request: string; context?: object };
      }
    | {
          type: "webauthn-response";
          payload: { pairingId: string; id: string; response: string };
      };

export interface PairingState {
    isConnected: boolean;
    role: PairingRole | null;
    pairingId?: string;
    pairingCode?: string;
    deviceName?: string;
}

export interface WebAuthnRequest {
    id: string;
    request: string;
    context?: object;
}
