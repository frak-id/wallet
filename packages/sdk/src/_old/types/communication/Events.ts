import type { GetPricesParam, GetPricesResponse } from "../price/GetPrices.ts";
import type {
    GetUnlockStatusParam,
    GetUnlockStatusResponse,
} from "../unlock/UnlockStatus.ts";
import type {
    GetUserStatusParam,
    GetUserStatusResponse,
} from "../user/UserStatus.ts";
import type { CompressedData } from "./Encoded";

/**
 * Generic events params
 */
export type EventsParam =
    | {
          key: "get-price-param";
          value: GetPricesParam;
      }
    | {
          key: "unlock-status-param";
          value: GetUnlockStatusParam;
      }
    | {
          key: "user-status-param";
          value: GetUserStatusParam;
      };

/**
 * Generic events response
 */
export type EventsResponse =
    | {
          key: "get-price-response";
          value: GetPricesResponse;
      }
    | {
          key: "unlock-status-response";
          value: GetUnlockStatusResponse;
      }
    | {
          key: "user-status-response";
          value: GetUserStatusResponse;
      };

// Get the right response from an events params
export type EventResponseFromParam<T extends EventsParam> =
    T["key"] extends "get-price-param"
        ? GetPricesResponse
        : T["key"] extends "unlock-status-param"
          ? GetUnlockStatusResponse
          : T["key"] extends "user-status-param"
              ? GetUserStatusResponse
              : never;

/**
 * Format of an event
 */
export type EventsFormat = Readonly<{
    topic:
        | "get-price-param"
        | "unlock-status-param"
        | "user-status-param"
        | "get-price-response"
        | "unlock-status-response"
        | "user-status-response";
    id: string;
    data: CompressedData;
}>;

/**
 * Type of a decompressed event
 */
export type DecompressedFormat<Data> = Readonly<{
    topic:
        | "get-price-param"
        | "unlock-status-param"
        | "user-status-param"
        | "get-price-response"
        | "unlock-status-response"
        | "user-status-response";
    id: string;
    data: Data;
}>;
