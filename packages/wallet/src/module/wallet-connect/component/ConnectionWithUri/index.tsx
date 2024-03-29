import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Input } from "@/module/common/component/Input";
import { useWalletConnectToDapp } from "@/module/wallet-connect/hook/useWalletConnectToDapp";
import { useState } from "react";

export function checkWalletConnectUri(uri: string) {
    try {
        const url = new URL(uri);
        return (
            url.protocol === "wc:" &&
            url.searchParams.get("relay-protocol") !== null &&
            url.searchParams.get("symKey") !== null
        );
    } catch (error) {
        console.log("Invalid WalletConnect URI", error);
        return false;
    }
}

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
                onClick={async () => {
                    setErrorMessage(undefined);
                    if (!checkWalletConnectUri(connectionUri)) {
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
