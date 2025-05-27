import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { Button } from "@frak-labs/shared/module/component/Button";
import { useCopyToClipboardWithState } from "@shared/module/hook/useCopyToClipboardWithState";
import { Cuer } from "cuer";
import { ArrowDownToLine, Copy } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function QRCodeWallet() {
    const { t } = useTranslation();
    const { address } = useAccount();
    const { copied, copy } = useCopyToClipboardWithState();

    return (
        address && (
            <>
                <Panel size={"small"}>
                    <Title icon={<ArrowDownToLine width={32} height={32} />}>
                        <Trans i18nKey={"wallet.tokens.receive.title"} />
                    </Title>
                    {address && (
                        <div className={styles.QRCodeWallet__code}>
                            <Cuer
                                arena={"/icon.svg"}
                                value={address}
                                size={200}
                                color="#ffffff90"
                            />
                        </div>
                    )}
                    <p className={styles.QRCodeWallet__address}>{address}</p>
                </Panel>
                <Panel size={"none"} variant={"invisible"}>
                    <Button
                        width={"full"}
                        onClick={() => copy(address)}
                        className={styles.QRCodeWallet__button}
                    >
                        <Copy />
                        {copied ? t("common.copied") : t("common.copyAddress")}
                    </Button>
                </Panel>
            </>
        )
    );
}
