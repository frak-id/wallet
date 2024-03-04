# Nexus Wallet SDK

This SDK help any dApps, or gated content provider, use the [Nexus Wallet](https://poc-wallet.frak.id/) as a regular wallet, with smoother UX for your end-users (pay for his gas fees, check the paywall options, track his consumption etc.)

Checkout our documentation for more informations about the usage:
 - [React client usage](https://docs.frak.id/wallet-sdk/how-to/client-react)
 - [Core client usage](https://docs.frak.id/wallet-sdk/how-to/client-core)

To have more info about how does it works under the hood, you can check [this](https://docs.frak.id/wallet-sdk/under-the-hood)

> :warning: **This is in active development**: Only supporting polygon Mumbai at the moment, **DO NOT USE IN PROD**


## Installation

```bash
bun add viem @frak-labs/nexus-sdk
```

## Setup

```ts
import {
    createIframe,
    createIFrameNexusClient,
} from "@frak-labs/nexus-sdk/core";
import type { NexusClient, NexusWalletSdkConfig } from "@frak-labs/nexus-sdk/core";

// Create the config for the Nexus Wallet SDK
export const nexusConfig: NexusWalletSdkConfig = {
    // The current url for the wallet sdk
    walletUrl: "https://poc-wallet.frak.id",
    // The content id on which this sdk will be used
    contentId: "0xdeadbeef",
    // The content title, this will be displayed to the user during a few registration steps
    contentTitle: "My dApp content title"
}

// Create the iFrame and the associated NexusClient
async function createClient(): Promise<NexusClient> {
    // Create the iFrame that will be used for the communication with the nexus wallet
    const iframe = await createIframe(nexusConfig);

    // Build the client
    const client = createIFrameNexusClient(nexusConfig, iframe);

    // Wait for it to be ready
    await client.waitForConnection();

    // And then return it
    return client;
}

// Create the client and use it
export const nexusClient = await createClient();
```

## Sample usage

Sample code to watch the current user wallet status:

```ts
import { nexusClient } from "./client";
import { watchWalletStatus } from "@frak-labs/nexus-sdk/actions";
import type { WalletStatusReturnType } from "@frak-labs/nexus-sdk/core";

// Watch the wallet status
watchWalletStatus(nexusClient, (walletStatus: WalletStatusReturnType) => {
    console.log("Wallet status changed", { walletStatus });
    // You can now use the status to update your UI
});
```

