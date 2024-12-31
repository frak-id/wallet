import { currentChain } from "@/context/blockchain/provider";
import { createPrivyCrossAppClient } from "@privy-io/cross-app-connect";

/**
 * The privy cross app client
 *  - Here we are referencing the abstract provider app
 *
 *  -
 */
export const crossAppClient = createPrivyCrossAppClient({
    providerAppId: "cm04asygd041fmry9zmcyn5o5",
    chains: [currentChain],
    chainId: currentChain.id,
    connectionOpts: {
        smartWalletMode: false,
    },
    // @ts-ignore, not in option spec but used in the implementation
    apiUrl: "https://auth.privy.io",
});
