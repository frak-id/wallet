import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Input } from "@/module/common/component/Input";
import { useWalletConnectToDapp } from "@/module/wallet-connect/hook/useWalletConnectToDapp";
import { useState } from "react";

export function ConnectionWithUri() {
    const [connectionUri, setConnectionUri] = useState<string>("");
    const { onConnect, error } = useWalletConnectToDapp();

    return (
        <>
            <p>Connection URI</p>
            <Input
                type={"text"}
                value={connectionUri}
                onChange={(e) => setConnectionUri(e.target.value ?? "")}
            />
            <ButtonRipple
                size={"small"}
                onClick={async () => {
                    await onConnect(connectionUri);
                    setConnectionUri("");
                }}
            >
                Connect
            </ButtonRipple>
            {error?.message && <p className={"error"}>{error?.message}</p>}
        </>
    );
}
