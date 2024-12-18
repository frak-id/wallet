import { currentChain } from "@/context/blockchain/provider";
import { createPrivyCrossAppClient } from "@privy-io/cross-app-connect";

export const crossAppClient = createPrivyCrossAppClient({
    // todo: This is the provider app id for Abstract wallet, maybe should find another one, idk
    providerAppId: "cm04asygd041fmry9zmcyn5o5",
    chains: [currentChain],
    chainId: currentChain.id,
    connectionOpts: {
        smartWalletMode: false,
    },
    // @ts-ignore, not in option spec but used in the implementation
    apiUrl: "https://auth.privy.io",
});
