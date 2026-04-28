import type {
    WsPairingCreatedResponse,
    WsPartnerConnected,
    WsSignatureReject,
    WsSignatureResponse,
    WsTopicSignatureRequest,
} from "@frak-labs/backend-elysia/domain/pairing";
import type { Address, Hex } from "viem";
import type { DistantWebAuthnWallet } from "../../types/Session";
import type { SignatureRejectReason } from "./errors";

/**
 * Identity node for origin device, used for identity resolution when pairing completes
 */
export type OriginIdentityNode =
    | { type: "anonymous_fingerprint"; value: string; merchantId: string }
    | { type: "wallet"; value: Address };

/**
 * All the messages that could be received by the target.
 *
 * `WsSignatureReject` covers two scenarios on this side:
 *   - origin user cancelled the request (`reason.code === "user-cancelled"`)
 *   - server-side TTL expired (`reason.code === "expired"`)
 *
 * The handler simply removes the request from `pendingSignatures`; the
 * UI can derive a toast from the `reason.code` if desired.
 */
export type WsTargetMessage =
    | WsTopicSignatureRequest
    | { type: "ping"; payload: { pairingId: string } }
    | WsPartnerConnected
    | WsSignatureReject;

/**
 * All the messages that could be received by the origin.
 *  - We override the wallet type to use DistantWebAuthnWallet from the client.
 *
 * `WsSignatureReject` is what rejects a pending signature promise on the
 * origin (target user declined, server timeout, peer disconnected, …).
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
 * All the requests that could be sent to the backend by the origin.
 *
 * `signature-reject` is now bidirectional — origin uses it to abort a
 * request the user cancelled (closed the dApp modal, etc.).
 */
export type WsOriginRequest =
    | { type: "ping" }
    | {
          type: "signature-request";
          payload: { id: string; request: Hex; context?: object };
      }
    | {
          type: "signature-reject";
          payload: { id: string; reason: SignatureRejectReason };
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
          payload: {
              pairingId: string;
              id: string;
              reason: SignatureRejectReason;
          };
      }
    | {
          type: "pong";
          payload: {
              pairingId: string;
          };
      };
