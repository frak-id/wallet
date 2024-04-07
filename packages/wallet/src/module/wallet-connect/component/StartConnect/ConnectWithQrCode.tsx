import { isValidConnectionUri } from "@/context/wallet-connect/pairing";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { useWalletConnectToDapp } from "@/module/wallet-connect/hook/useWalletConnectToDapp";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import styles from "./index.module.css";

const ReactQrReader = dynamic(() => import("react-qr-reader-es6"), {
    ssr: false,
});

async function isConnectedVideoDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videosDevices = devices.filter(
        (device) => device.kind === "videoinput"
    );
    return videosDevices.length > 0;
}

export function ConnectWithQrCode() {
    const { onConnect, status, error } = useWalletConnectToDapp();
    const [show, setShow] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const [isVideoDeviceAvailable, setIsVideoDeviceAvailable] = useState(false);

    useEffect(() => {
        isConnectedVideoDevices().then(setIsVideoDeviceAvailable);
    }, []);

    const onError = useCallback((error: Error) => {
        setShow(false);
        setErrorMessage(error.message);
        console.log("Error scanning QR code", error);
    }, []);

    const onScan = useCallback(
        async (data: string | null) => {
            if (!data) return;
            if (!isValidConnectionUri(data)) {
                setShow(false);
                setErrorMessage("Invalid WalletConnect URI");
                return;
            }
            await onConnect(data);
            setShow(false);
        },
        [onConnect]
    );

    useEffect(() => {
        status === "error" && setErrorMessage(error?.message);
    }, [status, error?.message]);

    return (
        isVideoDeviceAvailable && (
            <div className={styles.qrReader}>
                {show && (
                    <div className={styles.qrReader__reader}>
                        <ReactQrReader
                            showViewFinder={false}
                            onError={onError}
                            onScan={onScan}
                            facingMode={"environment"}
                        />
                    </div>
                )}

                <ButtonRipple
                    onClick={() => {
                        setErrorMessage(undefined);
                        setShow(!show);
                    }}
                    size={"small"}
                >
                    <p>{show ? "Hide" : "Show"} QR code scanner</p>
                </ButtonRipple>
                {errorMessage && <p className={"error"}>{errorMessage}</p>}
            </div>
        )
    );
}
