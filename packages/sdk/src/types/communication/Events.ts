import type { GetPricesParam, GetPricesResponse } from "../price/GetPrices.ts";
import type {
    GetUnlockStatusParam,
    GetUnlockStatusResponse,
} from "../unlock/UnlockStatus.ts";
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
      };

// Get the right response from an events params
export type EventResponseFromParam<T extends EventsParam> =
    T["key"] extends "get-price-param"
        ? GetPricesResponse
        : T["key"] extends "unlock-status-param"
          ? GetUnlockStatusResponse
          : never;

/**
 * Format of an event
 */
export type EventsFormat = Readonly<{
    topic:
        | "get-price-param"
        | "unlock-status-param"
        | "get-price-response"
        | "unlock-status-response";
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
        | "get-price-response"
        | "unlock-status-response";
    id: string;
    data: Data;
}>;
