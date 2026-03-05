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
          /** @deprecated V1 legacy — use referrerClientId for v2 */
          referrerWallet?: Address;
          referrerClientId?: string;
          referrerMerchantId?: string;
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
