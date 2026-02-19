import type {
    WsPairingCreatedResponse,
    WsPartnerConnected,
    WsSignatureReject,
    WsSignatureResponse,
    WsTopicSignatureRequest,
} from "@frak-labs/backend-elysia/domain/pairing";
import type { Address, Hex } from "viem";
import type { DistantWebAuthnWallet } from "../../types/Session";

/**
 * Identity node for origin device, used for identity resolution when pairing completes
 */
export type OriginIdentityNode =
    | { type: "anonymous_fingerprint"; value: string; merchantId: string }
    | { type: "merchant_customer"; value: string; merchantId: string }
    | { type: "wallet"; value: Address };

/**
 * All the messages that could be received by the target
 */
export type WsTargetMessage =
    | WsTopicSignatureRequest
    | { type: "ping"; payload: { pairingId: string } }
    | WsPartnerConnected;

/**
 * All the messages that could be received by the origin
 *  - We override the wallet type to use DistantWebAuthnWallet from the client
 */
export type WsOriginMessage =
    | WsSignatureResponse
    | WsSignatureReject
    | { type: "pong"; payload: { pairingId: string } }
    | WsPairingCreatedResponse
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
 * All the requests that could be sent to the backend by the origin
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
 * All the requests that could be sent to the backend by the target
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
