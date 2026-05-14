import { selectDemoPrivateKey, sessionStore } from "@frak-labs/wallet-shared";
import { KeyRound } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLogout } from "@/module/authentication/hook/useLogout";
import { useBiometricConfirm } from "@/module/biometrics";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";

export function PrivateKey() {
    const { t } = useTranslation();
    const privateKey = sessionStore(selectDemoPrivateKey);
    const { confirm, isConfirming } = useBiometricConfirm();
    const { logout, isLoggingOut } = useLogout();

    const handleDelete = useCallback(async () => {
        const confirmed = await confirm();
        if (confirmed) await logout();
    }, [confirm, logout]);

    if (!privateKey) return null;

    return (
        <InfoCard>
            <InfoRow
                icon={KeyRound}
                label={t("wallet.settings.deletePrivateKey")}
                onClick={handleDelete}
                disabled={isConfirming || isLoggingOut}
            />
        </InfoCard>
    );
}
