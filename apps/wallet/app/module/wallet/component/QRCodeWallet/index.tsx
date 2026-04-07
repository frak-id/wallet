import { Button } from "@frak-labs/design-system/components/Button";
import { useCopyToClipboardWithState } from "@frak-labs/wallet-shared";
import { Cuer } from "cuer";
import { ArrowDownToLine, Copy } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

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
                        <div className={styles.qrCodeWalletCode}>
                            <Cuer
                                arena={"/icon.svg"}
                                value={address}
                                size={200}
                                color="#ffffff90"
                            />
                        </div>
                    )}
                    <p className={styles.qrCodeWalletAddress}>{address}</p>
                </Panel>
                <Panel size={"none"} variant={"invisible"}>
                    <Button
                        className={styles.qrCodeWalletButton}
                        onClick={() => copy(address)}
                    >
                        <Copy />
                        {copied ? t("common.copied") : t("common.copyAddress")}
                    </Button>
                </Panel>
            </>
        )
    );
}
