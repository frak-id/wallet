import type { UtmParams } from "../tracking";

/**
 * Parameters for sending interactions via RPC
 *
 * Note: merchantId, clientId, and walletReferrer come from WalletRpcContext
 * and are NOT included in the params - they are resolved by the listener
 *
 * @group RPC Schema
 */
export type SendInteractionParamsType =
    | {
          type: "arrival";
          landingUrl?: string;
          utmParams?: UtmParams;
      }
    | {
          type: "sharing";
      }
    | {
          type: "custom";
          customType: string;
          data?: Record<string, unknown>;
          idempotencyKey?: string;
      };
