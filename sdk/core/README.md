# Frak Wallet Core SDK

This SDK help any dApps, or gated content provider, use the [Frak Wallet](https://wallet.frak.id/) as a regular wallet, with smoother UX for your end-users (pay for his gas fees, check the paywall options, track his consumption etc.)

Checkout our documentation for more information's about the usage:
 - [React client usage](https://docs.frak.id/wallet-sdk/how-to/client-react)
 - [Core client usage](https://docs.frak.id/wallet-sdk/how-to/client-core)

To have more info about how does it works under the hood, you can check [this](https://docs.frak.id/wallet-sdk/under-the-hood)

> :warning: **This is in active development**: Only supporting testnets at the moment, **DO NOT USE IN PROD**


## Installation

```bash
bun add viem @frak-labs/core-sdk
```

## Setup

```ts
import { setupClient } from "@frak-labs/core-sdk";
import type { NexusClient, NexusWalletSdkConfig } from "@frak-labs/core-sdk";

// Create the config for the Frak Wallet SDK
export const nexusConfig: NexusWalletSdkConfig = {
    // The name of your dapp
    metadata: {
        // Your app name
        name: string,
    },
}

// Create the client and use it
export const nexusClient = await setupClient({ config: nexusConfig });
```

## Sample usage

Sample code to watch the current user wallet status:

```ts
import { nexusClient } from "./client";
import { watchWalletStatus } from "@frak-labs/core-sdk/actions";
import type { WalletStatusReturnType } from "@frak-labs/core-sdk";

// Watch the wallet status
watchWalletStatus(nexusClient, (walletStatus: WalletStatusReturnType) => {
    console.log("Wallet status changed", { walletStatus });
    // You can now use the status to update your UI
});
```
