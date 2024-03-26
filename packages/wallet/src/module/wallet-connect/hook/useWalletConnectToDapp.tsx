import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import type { Web3WalletTypes } from "@walletconnect/web3wallet";
import { useEffect } from "react";

export function useWalletConnectToDapp({
    connectionUri,
}: { connectionUri: string }) {
    const { wallet } = useWallet();
    const { walletConnectInstance, setInstanceData } = useWalletConnect();

    async function onSessionProposal({
        id,
        params,
    }: Web3WalletTypes.SessionProposal) {
        console.log("Wallet connect session proposal", { id, params });

        if (!walletConnectInstance) return;

        try {
            const chains = [
                // Polygon mumbai and amoy
                "eip155:80001",
                "eip155:80002",
                // Polygon mainnet
                "eip155:137",
                // Arbitrum sepolia
                "eip155:421614",
                // Arbitrum mainnet
                "eip155:42161",
            ];

            const namespaces = buildApprovedNamespaces({
                proposal: params,
                supportedNamespaces: {
                    eip155: {
                        chains,
                        methods: [
                            // Signature stuff
                            "personal_sign",
                            "eth_sign",
                            "eth_signTypedData",
                            "eth_signTypedData_v3",
                            "eth_signTypedData_v4",
                            // Sending tx
                            "eth_sendTransaction",
                        ],
                        events: ["accountsChanged", "chainChanged"],
                        accounts: chains.flatMap(
                            (chain) => `${chain}:${wallet.address}`
                        ),
                    },
                },
            });
            // Approve session proposal, use id from session proposal event and respond with namespace(s) that satisfy dapps request and contain approved accounts
            const { topic, acknowledged } =
                await walletConnectInstance.approveSession({
                    id,
                    namespaces,
                });
            console.log("Wallet connect session proposal approved", {
                topic,
                acknowledged,
            });
            setInstanceData();
        } catch (error) {
            console.error("Wallet connect session proposal error", { error });
            await walletConnectInstance.rejectSession({
                id,
                reason: getSdkError("USER_REJECTED"),
            });
        }
    }

    useEffect(() => {
        if (!walletConnectInstance) return;
        walletConnectInstance.on("session_proposal", onSessionProposal);
        // walletConnectInstance.on("session_request", (proposal) => {
        //     console.log("Wallet connect session request", { proposal });
        // });
        // walletConnectInstance.on("auth_request", (proposal) => {
        //     console.log("Wallet connect auth request", { proposal });
        // });
        // walletConnectInstance.on("session_delete", (proposal) => {
        //     console.log("Wallet connect session delete", { proposal });
        // });

        return () => {
            walletConnectInstance.off("session_proposal", onSessionProposal);
        };
    }, [walletConnectInstance]);

    const {
        mutate: onConnect,
        status,
        error,
    } = useMutation({
        mutationKey: ["wallet-connect-pairing", connectionUri],
        mutationFn: async () => {
            if (!(connectionUri && walletConnectInstance)) return true;

            console.log("Wallet connect pairing with uri", {
                connectionUri,
            });

            await walletConnectInstance.pair({
                uri: connectionUri,
            });
        },
    });

    return {
        onConnect,
        status,
        error,
    };
}
