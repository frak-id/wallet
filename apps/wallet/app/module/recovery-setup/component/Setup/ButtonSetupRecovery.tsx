import { Button } from "@frak-labs/ui/component/Button";
import { currentChain } from "@frak-labs/wallet-shared/blockchain/provider";
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
                width={"full"}
                isLoading={isPending}
                disabled={isPending || isSuccess}
                onClick={async () => {
                    if (!recoveryOptions) return;
                    await setupRecoveryAsync({
                        setupTxData: recoveryOptions.setupTxData,
                    });
                    onSuccess();
                }}
                leftIcon={isSuccess ? <Check /> : isError ? <X /> : undefined}
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
