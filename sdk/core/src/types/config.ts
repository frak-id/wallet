/**
 * Configuration for the Nexus Wallet SDK
 */
export type FrakWalletSdkConfig = Readonly<{
    // The current url for the wallet sdk
    walletUrl?: string;
    // Your own datas
    metadata: {
        // Your app name
        name: string;
        // Your app styles to skin modals / sso
        css?: string;
        // Your button to trigger the wallet share modal
        buttonShare?: string;
    };
    // Your domain (will be retrieved automatically if not provided)
    domain?: string;
}>;
