import type { Address } from "viem";

/**
 * Parameters for sending interactions via RPC
 *
 * Note: merchantId and clientId come from WalletRpcContext
 * and are NOT included in the params - they are resolved by the listener
 *
 * @group RPC Schema
 */
export type SendInteractionParamsType =
    | {
          type: "arrival";
          referrerWallet?: Address;
          landingUrl?: string;
          utmSource?: string;
          utmMedium?: string;
          utmCampaign?: string;
          utmTerm?: string;
          utmContent?: string;
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
