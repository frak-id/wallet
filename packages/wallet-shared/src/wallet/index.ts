// Actions
export { getRegisterOptions } from "./action/registerOptions";

// Query Keys
export { claimableKey } from "./queryKeys/claimable";

// Smart Wallet
export type { BaseFrakSmartAccount } from "./smartWallet/baseFrakWallet";
export { baseFrakWallet } from "./smartWallet/baseFrakWallet";
export type {
    FrakWalletConnector,
    FrakWalletConnectorFn,
} from "./smartWallet/connector";
export { smartAccountConnector } from "./smartWallet/connector";
export { frakEcdsaWalletSmartAccount } from "./smartWallet/FrakEcdsaSmartWallet";
export { frakPairedWalletSmartAccount } from "./smartWallet/FrakPairedSmartWallet";
export { frakWalletSmartAccount } from "./smartWallet/FrakSmartWallet";
export type {
    SmartAccountConnectorClient,
    SmartAccountProviderType,
} from "./smartWallet/provider";
export { getSmartAccountProvider } from "./smartWallet/provider";
export type { AccountMetadata } from "./smartWallet/signature";
export {
    fetchAccountMetadata,
    signHashViaWebAuthN,
    wrapMessageForSignature,
} from "./smartWallet/signature";
export {
    formatSignature,
    getStubSignature,
} from "./smartWallet/webAuthN";

export { encodeWalletMulticall } from "./utils/multicall";
