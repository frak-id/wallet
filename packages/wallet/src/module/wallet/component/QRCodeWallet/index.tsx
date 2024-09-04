import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useCopyToClipboardWithState } from "@module/hook/useCopyToClipboardWithState";
import { ArrowDownToLine, Copy } from "lucide-react";
import { useQRCode } from "next-qrcode";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function QRCodeWallet() {
    const { address } = useAccount();
    const { copied, copy } = useCopyToClipboardWithState();
    const { Canvas } = useQRCode();

    return (
        address && (
            <>
                <Panel size={"small"}>
                    <Title icon={<ArrowDownToLine width={32} height={32} />}>
                        Receive assets on <b>Testnets</b>
                    </Title>
                    {address && (
                        <div className={styles.QRCodeWallet__code}>
                            <Canvas
                                text={address}
                                options={{
                                    errorCorrectionLevel: "M",
                                    margin: 3,
                                    scale: 4,
                                    width: 200,
                                    color: {
                                        dark: "#000000ff",
                                        light: "#ffffff90",
                                    },
                                }}
                            />
                        </div>
                    )}
                    <p className={styles.QRCodeWallet__address}>{address}</p>
                </Panel>
                <Panel size={"none"} variant={"empty"}>
                    <ButtonRipple
                        onClick={() => copy(address)}
                        timeout={300}
                        className={styles.QRCodeWallet__button}
                    >
                        <Copy />
                        {copied ? <>Copied!</> : "Copy address"}
                    </ButtonRipple>
                </Panel>
            </>
        )
    );
}
