"use client";

import { Core } from "@walletconnect/core";
import { Web3Wallet } from "@walletconnect/web3wallet";
import {DI} from "@/context/common/di";

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
    getter: async () => {
        // Check a few stuff about the core component
        console.log("WalletConnect core", { walletConnectCore });
        // Initialise the web3 connect interface
        const walletConnectWallet = await Web3Wallet.init({
            core: walletConnectCore,
            name: "Nexus Wallet - Frak",
            metadata: {
                name: "Nexus Wallet - Frak",
                description: "Nexus wallet by Frak.",
                url: "poc-wallet.frak.id",
                icons: ["https://poc-wallet.frak.id/favicons/icon.svg"],
            },
        });
        console.log("WalletConnect wallet", { walletConnectWallet });
        return walletConnectWallet;
    },
})