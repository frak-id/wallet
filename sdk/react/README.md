# Frak Wallet React SDK

This SDK help any dApps, or gated content provider, use the [Frak Wallet](https://wallet.frak.id/) as a regular wallet, with smoother UX for your end-users (pay for his gas fees, check the paywall options, track his consumption etc.)

Checkout our documentation for more information's about the usage:
 - [React client usage](https://docs.frak.id/wallet-sdk/how-to/client-react)
 - [Core client usage](https://docs.frak.id/wallet-sdk/how-to/client-core)

To have more info about how does it works under the hood, you can check [this](https://docs.frak.id/wallet-sdk/under-the-hood)

> :warning: **This is in active development**: Only supporting testnets at the moment, **DO NOT USE IN PROD**


## Installation

```bash
bun add viem @tanstack/react-query @frak-labs/react-sdk
```

## Setup

### Add the provider

```tsx
import {
    NexusConfigProvider,
    NexusIFrameClientProvider,
} from "@frak-labs/react-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

const queryClient = new QueryClient();

const nexusConfig = {
    metadata: {
        name: "Your App Name",
    },
};

export function NexusProvider({ children }: PropsWithChildren) {
    return (
        <NexusConfigProvider config={nexusConfig}>
            <NexusIFrameClientProvider>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </NexusIFrameClientProvider>
        </NexusConfigProvider>
    );
}
```

### In your app

```tsx
import { NexusProvider } from './NexusProvider';

function App() {
    return (
        <NexusProvider>
            {/* Your app content */}
        </NexusProvider>
    );
}

export default App;
```

## Sample usage

Sample code to watch the current user wallet status:

```tsx
function WalletStatus() {
    const { data: walletStatus, isLoading, error } = useWalletStatus();

    if (isLoading) return <div>Loading wallet status...</div>;
    if (error) return <div>Error: {error.message}</div>;

    return (
        <div>
            Wallet status:{" "}
            {walletStatus?.key === "connected" ? "Connected" : "Not connected"}
        </div>
    );
}
```
