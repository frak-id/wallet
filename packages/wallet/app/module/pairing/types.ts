import type { Hex } from "viem";

export type PairingRole = "origin" | "target";

type WsPartnerConnected = {
    type: "partner-connected";
    payload: {
        pairingId: string;
        deviceName: string;
    };
};

/**
 * All the message that could be receive by the target
 */
export type WsTargetMessage =
    | {
          type: "signature-request";
          payload: {
              pairingId: string;
              id: string;
              request: Hex;
              context?: object;
          };
      }
    | {
          type: "ping";
          payload: {
              pairingId: string;
          };
      }
    | WsPartnerConnected;

/**
 * All the message that could be receive by the origin
 */
export type WsOriginMessage =
    | {
          type: "signature-response";
          payload: { pairingId: string; id: string; signature: Hex };
      }
    | {
          type: "pong";
          payload: {
              pairingId: string;
          };
      }
    | {
          type: "pairing-initiated";
          payload: {
              pairingId: string;
              pairingCode: string;
          };
      }
    | WsPartnerConnected;

/**
 * All the request that could be sent to the backend by the origin
 */
export type WsOriginRequest =
    | {
          type: "ping";
      }
    | {
          type: "signature-request";
          payload: { id: string; request: Hex; context?: object };
      };

/**
 * All the request that could be sent to the backend by the target
 */
export type WsTargetRequest =
    | {
          type: "signature-response";
          payload: { pairingId: string; id: string; signature: Hex };
      }
    | {
          type: "pong";
          payload: {
              pairingId: string;
          };
      };
