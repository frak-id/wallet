import type { GetPricesParam, GetPricesResponse } from "../price/GetPrices.ts";
import type {
    GetUnlockStatusParams,
    GetUnlockStatusResponse,
} from "../unlock/UnlockStatus.ts";
import type { CompressedData } from "./Encoded.ts";

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

/**
 * Format of an event
 */
export type EventsFormat = Readonly<{
    topic: "get-price" | "unlock-status";
    data: CompressedData;
}>;
