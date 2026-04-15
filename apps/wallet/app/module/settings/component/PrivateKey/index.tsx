import { Button } from "@frak-labs/design-system/components/Button";
import { selectDemoPrivateKey, sessionStore } from "@frak-labs/wallet-shared";
import { KeyRound } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useBiometricConfirm } from "@/module/biometrics";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

export function PrivateKey() {
    const { t } = useTranslation();
    const privateKey = sessionStore(selectDemoPrivateKey);

    if (privateKey) {
        return (
            <Panel size={"small"}>
                <Title icon={<KeyRound size={32} />}>
                    {t("wallet.settings.privateKey")}
                </Title>
                <DeletePrivateKey />
            </Panel>
        );
    }

    return null;
}

function DeletePrivateKey() {
    const { t } = useTranslation();
    const setPrivateKey = sessionStore.getState().setDemoPrivateKey;
    const { confirm, isConfirming } = useBiometricConfirm();

    const deletePrivateKey = useCallback(async () => {
        const confirmed = await confirm();
        if (confirmed) {
            setPrivateKey(null);
        }
    }, [setPrivateKey, confirm]);

    return (
        <div className={styles.container}>
            <Button
                variant={"primary"}
                onClick={deletePrivateKey}
                disabled={isConfirming}
            >
                {t("wallet.settings.deletePrivateKey")}
            </Button>
        </div>
    );
}
