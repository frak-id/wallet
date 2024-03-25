import { getWalletConnectWallet } from "@/context/wallet-connect/provider";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Input } from "@/module/common/component/Input";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import { buildApprovedNamespaces } from "@walletconnect/utils";
import { useState } from "react";

export function CreateWalletConnectConnection() {
    const [connectionUri, setConnectionUri] = useState<string>("");

    const { wallet } = useWallet();

    const {
        mutate: onConnect,
        status,
        error,
    } = useMutation({
        mutationKey: ["wallet-connect-pairing", connectionUri],
        mutationFn: async () => {
            console.log("Wallet connect pairing with uri", { connectionUri });
            const walletConnectWallet = await getWalletConnectWallet();

            walletConnectWallet.on("session_proposal", async (proposal) => {
                console.log("Wallet connect session proposal", { proposal });

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
                    proposal: proposal.params,
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
                    await walletConnectWallet.approveSession({
                        id: proposal.id,
                        namespaces,
                    });
                console.log("Wallet connect session proposal approved", {
                    topic,
                    acknowledged,
                });
            });
            walletConnectWallet.on("session_request", (proposal) => {
                console.log("Wallet connect session request", { proposal });
            });
            walletConnectWallet.on("auth_request", (proposal) => {
                console.log("Wallet connect auth request", { proposal });
            });
            walletConnectWallet.on("session_delete", (proposal) => {
                console.log("Wallet connect session delete", { proposal });
            });

            const result = await walletConnectWallet.pair({
                uri: connectionUri,
            });
            console.log("Wallet connect pairing result", { result });
        },
    });

    return (
        <Panel withShadow={false} size={"small"}>
            <Title>Wallet Connect</Title>

            <p>Connection URI</p>
            <Input
                type={"text"}
                value={connectionUri}
                onChange={(e) => setConnectionUri(e.target.value ?? "")}
            />

            <ButtonRipple
                onClick={() => {
                    onConnect();
                }}
            >
                Connect
            </ButtonRipple>

            <p>Status</p>
            <p>{status}</p>
            <p>Error</p>
            <p>{error?.message ?? "No error"}</p>
        </Panel>
    );
}
