import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useCopyAddress } from "@/module/wallet/hook/useCopyAddress";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { ArrowDownToLine, Copy } from "lucide-react";
import { useQRCode } from "next-qrcode";
import styles from "./index.module.css";

export function QRCodeWallet() {
    const { address } = useWallet();
    const { copied, copyAddress } = useCopyAddress();
    const { Canvas } = useQRCode();

    return (
        address && (
            <>
                <Panel withShadow={true} size={"small"}>
                    <Title icon={<ArrowDownToLine width={32} height={32} />}>
                        Receive assets on <b>Polygon Mumbai</b>
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
                        onClick={() => copyAddress(address)}
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
