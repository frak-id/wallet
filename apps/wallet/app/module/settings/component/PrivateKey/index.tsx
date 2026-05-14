import { selectDemoPrivateKey, sessionStore } from "@frak-labs/wallet-shared";
import { KeyRound } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useBiometricConfirm } from "@/module/biometrics";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";

export function PrivateKey() {
    const { t } = useTranslation();
    const privateKey = sessionStore(selectDemoPrivateKey);
    const setPrivateKey = sessionStore.getState().setDemoPrivateKey;
    const { confirm, isConfirming } = useBiometricConfirm();

    const handleDelete = useCallback(async () => {
        const confirmed = await confirm();
        if (confirmed) setPrivateKey(null);
    }, [setPrivateKey, confirm]);

    if (!privateKey) return null;

    return (
        <InfoCard>
            <InfoRow
                icon={KeyRound}
                label={t("wallet.settings.deletePrivateKey")}
                onClick={handleDelete}
                disabled={isConfirming}
            />
        </InfoCard>
    );
}
