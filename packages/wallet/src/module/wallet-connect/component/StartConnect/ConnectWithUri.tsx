import { isValidConnectionUri } from "@/context/wallet-connect/pairing";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Input } from "@/module/common/component/Input";
import { useWalletConnectToDapp } from "@/module/wallet-connect/hook/useWalletConnectToDapp";
import { useState } from "react";

export function ConnectionWithUri() {
    const [connectionUri, setConnectionUri] = useState<string>("");
    const { onConnect, error } = useWalletConnectToDapp();
    const [errorMessage, setErrorMessage] = useState<string>();

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
                    setErrorMessage(undefined);
                    if (!isValidConnectionUri(connectionUri)) {
                        setErrorMessage("Invalid WalletConnect URI");
                        return;
                    }
                    await onConnect(connectionUri);
                    setConnectionUri("");
                }}
            >
                Connect
            </ButtonRipple>
            {(errorMessage || error?.message) && (
                <p className={"error"}>{errorMessage || error?.message}</p>
            )}
        </>
    );
}
