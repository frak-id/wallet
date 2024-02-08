import type { GetPricesParam, GetPricesResponse } from "../price/GetPrices.ts";
import type {
    GetUnlockStatusParams,
    GetUnlockStatusResponse,
} from "../unlock/UnlockStatus.ts";

/**
 * Generic events params
 */
export type EventsParam =
    | {
          key: "get-price";
          value: GetPricesParam;
      }
    | {
          key: "unlock-status";
          value: GetUnlockStatusParams;
      };

/**
 * Generic events response
 */
export type EventsResponse =
    | {
          key: "get-price";
          value: GetPricesResponse;
      }
    | {
          key: "unlock-status";
          value: GetUnlockStatusResponse;
      };
