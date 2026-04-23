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
          /** Sharer wallet address. Accepted in both V1 (legacy, wallet-only) and V2 (authenticated sharer) contexts. */
          referrerWallet?: Address;
          referrerClientId?: string;
          referrerMerchantId?: string;
          /** Epoch seconds timestamp from the referral link creation */
          referralTimestamp?: number;
          landingUrl?: string;
          utmSource?: string;
          utmMedium?: string;
          utmCampaign?: string;
          utmTerm?: string;
          utmContent?: string;
      }
    | {
          type: "sharing";
          /** Epoch seconds timestamp matching the V2 context `t` field embedded in the referral link URL, used for backend correlation */
          sharingTimestamp?: number;
          /** Merchant order ID linking this sharing event to a purchase (stays server-side, never in URL) */
          purchaseId?: string;
      }
    | {
          type: "custom";
          customType: string;
          data?: Record<string, unknown>;
          idempotencyKey?: string;
      };
