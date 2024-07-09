"use client";

import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { NexusIFrameClientProvider } from "@frak-labs/nexus-sdk/react";
import { NexusConfigProvider } from "@frak-labs/nexus-sdk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

// The query client that will be used by tanstack/react-query
const queryClient = new QueryClient();

export function RootProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <NexusConfigProvider config={frakWalletSdkConfig}>
                <NexusIFrameClientProvider>
                    {children}
                </NexusIFrameClientProvider>
            </NexusConfigProvider>
        </QueryClientProvider>
    );
}
