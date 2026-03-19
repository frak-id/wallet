import { Button } from "@frak-labs/design-system/components/Button";
import { currentChain } from "@frak-labs/wallet-shared";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSetupRecovery } from "@/module/recovery-setup/hook/useSetupRecovery";
import {
    recoveryStore,
    selectRecoveryOptions,
} from "@/module/stores/recoveryStore";

export function ButtonSetupRecovery({
    className = "",
    onSuccess,
}: {
    className?: string;
    onSuccess: () => void;
}) {
    const { t } = useTranslation();
    // Get the recovery options
    const recoveryOptions = recoveryStore(selectRecoveryOptions);

    // Setup recovery
    const { setupRecoveryAsync, isPending, isSuccess, isError, error } =
        useSetupRecovery({
            onSuccess: () => {
                onSuccess();
            },
        });

    return (
        <>
            <Button
                disabled={isPending || isSuccess}
                onClick={async () => {
                    if (!recoveryOptions) return;
                    await setupRecoveryAsync({
                        setupTxData: recoveryOptions.setupTxData,
                    });
                    onSuccess();
                }}
                icon={
                    isSuccess ? (
                        <Check size={16} />
                    ) : isError ? (
                        <X size={16} />
                    ) : undefined
                }
                className={className}
            >
                {t("wallet.recoverySetup.setupOn", {
                    name: currentChain.name,
                })}
            </Button>
            <span className="error">{isError ? error.message : ""}</span>
        </>
    );
}
