import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useCopyToClipboardWithState } from "@module/hook/useCopyToClipboardWithState";
import { ArrowDownToLine, Copy } from "lucide-react";
import { useQRCode } from "next-qrcode";
import { Trans, useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function QRCodeWallet() {
    const { t } = useTranslation();
    const { address } = useAccount();
    const { copied, copy } = useCopyToClipboardWithState();
    const { Canvas } = useQRCode();

    return (
        address && (
            <>
                <Panel size={"small"}>
                    <Title icon={<ArrowDownToLine width={32} height={32} />}>
                        <Trans i18nKey={"wallet.tokens.receive.title"} />
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
                        {copied ? t("common.copied") : t("common.copyAddress")}
                    </ButtonRipple>
                </Panel>
            </>
        )
    );
}
