import type { Hex } from "viem";
import type { DistantWebAuthnWallet } from "@/types/Session";

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
              partnerDeviceName: string;
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
          type: "signature-reject";
          payload: { pairingId: string; id: string; reason: string };
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
    | {
          type: "authenticated";
          payload: {
              token: string;
              sdkJwt: {
                  token: string;
                  expires: number;
              };
              wallet: DistantWebAuthnWallet;
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
          type: "signature-reject";
          payload: { pairingId: string; id: string; reason: string };
      }
    | {
          type: "pong";
          payload: {
              pairingId: string;
          };
      };
