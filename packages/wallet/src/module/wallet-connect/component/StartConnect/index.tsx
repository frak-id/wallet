import {getWalletConnectWallet} from "@/context/wallet-connect/provider";
import { Input } from "@/module/common/component/Input";
import { useState } from "react";
import {Panel} from "@/module/common/component/Panel";
import {Title} from "@/module/common/component/Title";
import {ButtonRipple} from "@/module/common/component/ButtonRipple";
import {useMutation} from "@tanstack/react-query";

export function CreateWalletConnectConnection() {
    const [connectionUri, setConnectionUri] = useState<string>("");

    const { mutate: onConnect, status, error } = useMutation({
        mutationKey: ["wallet-connect-pairing", connectionUri],
        mutationFn: async () => {
            console.log("Wallet connect pairing with uri", {connectionUri});
            const walletConnectWallet = await getWalletConnectWallet();

            walletConnectWallet.on("session_proposal", async (proposal) => {
                console.log("Wallet connect session proposal", {proposal});
                // Approve session proposal, use id from session proposal event and respond with namespace(s) that satisfy dapps request and contain approved accounts
                const { topic, acknowledged } = await walletConnectWallet.approveSession({
                    id: proposal.id,
                    namespaces: {
                        eip155: {
                            accounts: ['eip155:1:0x94f3f287f58e89e9F48bB3a149cFF8aAC3126FD4'],
                            methods: ['personal_sign', 'eth_sendTransaction'],
                            events: ['accountsChanged']
                        }
                    }
                })
                console.log("Wallet connect session proposal approved", {topic, acknowledged});
            });
            walletConnectWallet.on("session_request", (proposal) => {
                console.log("Wallet connect session request", {proposal});
            });
            walletConnectWallet.on("auth_request", (proposal) => {
                console.log("Wallet connect auth request", {proposal});
            });
            walletConnectWallet.on("session_delete", (proposal) => {
                console.log("Wallet connect session delete", {proposal});
            });


            const result = await walletConnectWallet.pair({uri: connectionUri});
            console.log("Wallet connect pairing result", {result});
        }
    })

    return (

        <Panel withShadow={false} size={"small"}>
            <Title>
                Wallet Connect
            </Title>

            <p>Connection URI</p>
            <Input
                type={"text"}
                value={connectionUri}
                onChangeValue={(value) => setConnectionUri(value ?? "")}
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
