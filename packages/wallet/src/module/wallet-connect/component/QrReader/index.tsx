import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { checkWalletConnectUri } from "@/module/wallet-connect/component/ConnectionWithUri";
import { useWalletConnectToDapp } from "@/module/wallet-connect/hook/useWalletConnectToDapp";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
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

export function QrReader() {
    const { onConnect, status, error } = useWalletConnectToDapp();
    const [show, setShow] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const [isVideoDeviceAvailable, setIsVideoDeviceAvailable] = useState(false);

    useEffect(() => {
        isConnectedVideoDevices().then(setIsVideoDeviceAvailable);
    }, []);

    function onError(error: Error) {
        setShow(false);
        setErrorMessage(error.message);
        console.log("Error scanning QR code", error);
    }

    async function onScan(data: string | null) {
        if (!data) return;
        if (!checkWalletConnectUri(data)) {
            setShow(false);
            setErrorMessage("Invalid WalletConnect URI");
            return;
        }
        await onConnect(data);
        setShow(false);
    }

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
