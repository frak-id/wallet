import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Input } from "@/module/common/component/Input";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useWalletConnectToDapp } from "@/module/wallet-connect/hook/useWalletConnectToDapp";
import { useState } from "react";

export function CreateWalletConnectConnection() {
    const [connectionUri, setConnectionUri] = useState<string>("");
    const { onConnect, status, error } = useWalletConnectToDapp({
        connectionUri,
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
