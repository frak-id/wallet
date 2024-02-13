// Config type
export type { FrakWalletSdkConfig } from "./Config";

// Unlock related exports
export type {
    GetUnlockStatusParam,
    GetUnlockStatusResponse,
} from "./unlock/UnlockStatus";
export type {
    UnlockRequestParams,
    UnlockRequestResult,
} from "./unlock/UnlockRequest";

// Prices related exports
export type {
    GetPricesParam,
    GetPricesResponse,
} from "./price/GetPrices";

// Global communication
export type {
    EventsParam,
    EventsResponse,
    EventResponseFromParam,
    EventsFormat,
} from "./communication/Events";
export type {
    RedirectionParams,
    RedirectionResponse,
} from "./communication/Redirections";
export type {
    CompressedData,
    HashProtectedData,
} from "./communication/Encoded";
