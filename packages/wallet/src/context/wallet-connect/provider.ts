"use client";

import { DI } from "@/context/common/di";
import { Core } from "@walletconnect/core";
import { Web3Wallet } from "@walletconnect/web3wallet";

/**
 * Initialize WalletConnect core instance
 */
const walletConnectCore = new Core({
    projectId: process.env.WALLETCONNECT_PROJECT_ID,
});

/**
 * Getter for the WalletConnect wallet
 */
export const getWalletConnectWallet = DI.registerAndExposeGetter({
    id: "wallet-connect",
    isAsync: true,
    // Initialise the web3 connect interface
    getter: async () =>
        await Web3Wallet.init({
            core: walletConnectCore,
            name: "Nexus Wallet - Frak",
            metadata: {
                name: "Nexus Wallet - Frak",
                description: "Nexus wallet by Frak.",
                url: "poc-wallet.frak.id",
                icons: ["https://poc-wallet.frak.id/favicons/icon.svg"],
            },
        }),
});
