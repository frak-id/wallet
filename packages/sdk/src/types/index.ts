// Config type
export type { FrakWalletSdkConfig } from "./Config";

// Unlock related exports
export type {
    GetUnlockStatusParams,
    GetUnlockStatusResponse,
} from "./unlock/UnlockStatus";
export type {
    UnlockRequestParams,
    UnlockRequestResponse,
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
} from "./communication/Events";
export type {
    RedirectionParams,
    RedirectionResponse,
} from "./communication/Redirections";
export type {
    CompressedData,
    HashProtectedData,
} from "./communication/Encoded";
