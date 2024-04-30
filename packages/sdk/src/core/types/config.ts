/**
 * Configuration for the Nexus Wallet SDK
 */
export type NexusWalletSdkConfig = Readonly<{
    // The current url for the wallet sdk
    walletUrl: string;
    // Your own datas
    metadata: {
        // Your app name
        name: string;
    };
}>;
